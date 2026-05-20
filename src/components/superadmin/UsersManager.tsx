import { useState } from 'react';
import { 
  Users, 
  Search,
  Building2,
  Shield,
  Mail,
  ShieldAlert,
  Check
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAllOrganizations } from '@/hooks/useSuperAdmin';
import { useSuperAdminUsers, useUpdateUserRoleBySuperAdmin } from '@/hooks/useSuperAdminUsers';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function UsersManager() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [newOrgId, setNewOrgId] = useState<string>('');
  const [showConfirmSuperAdmin, setShowConfirmSuperAdmin] = useState(false);
  const [hasConfirmedCheckbox, setHasConfirmedCheckbox] = useState(false);

  const { data: users, isLoading } = useSuperAdminUsers();
  const { data: organizations } = useAllOrganizations();
  const { user: currentUser } = useAuth();
  const updateRoleMutation = useUpdateUserRoleBySuperAdmin();

  const filteredUsers = users?.filter((user: any) => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.organizations?.name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || 
      user.user_roles?.some((r: any) => r.role === roleFilter);
    
    return matchesSearch && matchesRole;
  }) || [];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Badge className="bg-violet-500/10 text-violet-500 border-violet-500/20 font-medium">Super Admin</Badge>;
      case 'admin':
        return <Badge className="bg-primary/10 text-primary border-primary/20 font-medium">Admin</Badge>;
      case 'manager':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-medium">Gestor</Badge>;
      case 'seller':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">Vendedor</Badge>;
      case 'support':
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 font-medium">Suporte</Badge>;
      default:
        return <Badge variant="secondary" className="font-medium">{role}</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '??';
  };

  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    const firstRole = user.user_roles?.[0]?.role || 'seller';
    setNewRole(firstRole);
    setNewOrgId(user.organization_id || 'none');
    setShowConfirmSuperAdmin(firstRole === 'super_admin');
    setHasConfirmedCheckbox(false);
  };

  const handleSaveChanges = () => {
    if (!selectedUser) return;

    // Se estiver promovendo a super_admin e não marcou o checkbox de confirmação
    if (newRole === 'super_admin' && !hasConfirmedCheckbox && (selectedUser.user_roles?.[0]?.role !== 'super_admin')) {
      return;
    }

    const orgId = newOrgId === 'none' ? null : newOrgId;

    updateRoleMutation.mutate(
      {
        userId: selectedUser.id,
        role: newRole,
        organizationId: orgId,
      },
      {
        onSuccess: () => {
          setSelectedUser(null);
          setHasConfirmedCheckbox(false);
          setShowConfirmSuperAdmin(false);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        <p className="text-muted-foreground">Visualize e gerencie os cargos e acessos de todos os usuários da plataforma</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-2">{users?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Admins</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {users?.filter((u: any) => u.user_roles?.some((r: any) => r.role === 'admin')).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Gestores</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {users?.filter((u: any) => u.user_roles?.some((r: any) => r.role === 'manager')).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Vendedores</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {users?.filter((u: any) => u.user_roles?.some((r: any) => r.role === 'seller')).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-muted-foreground">Suporte</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {users?.filter((u: any) => u.user_roles?.some((r: any) => r.role === 'support')).length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Cargos</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Gestor</SelectItem>
                <SelectItem value="seller">Vendedor</SelectItem>
                <SelectItem value="support">Suporte</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name || 'Sem nome'}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {user.organizations?.name || 'Sem empresa'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.user_roles?.map((r: any, i: number) => (
                          <span key={i}>{getRoleBadge(r.role)}</span>
                        )) || <Badge variant="secondary">Sem cargo</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(user)}
                        disabled={user.id === currentUser?.id}
                        title={user.id === currentUser?.id ? 'Você não pode editar suas próprias permissões' : 'Editar permissões deste usuário'}
                      >
                        <Shield className="h-4 w-4 mr-1.5" />
                        Editar permissões
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Permissões Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => {
        if (!open) {
          setSelectedUser(null);
          setShowConfirmSuperAdmin(false);
          setHasConfirmedCheckbox(false);
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar permissões</DialogTitle>
            <DialogDescription>
              Ajuste as permissões do usuário. As alterações serão aplicadas em tempo real.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Usuário selecionado</span>
                <p className="text-sm font-semibold text-foreground">{selectedUser.full_name || 'Sem nome'}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {selectedUser.email}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Cargo / Papel</label>
                <Select 
                  value={newRole} 
                  onValueChange={(val) => {
                    setNewRole(val);
                    if (val === 'super_admin' && selectedUser.user_roles?.[0]?.role !== 'super_admin') {
                      setShowConfirmSuperAdmin(true);
                      setHasConfirmedCheckbox(false);
                    } else {
                      setShowConfirmSuperAdmin(false);
                      setHasConfirmedCheckbox(false);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Gestor (Manager)</SelectItem>
                    <SelectItem value="seller">Vendedor (Seller)</SelectItem>
                    <SelectItem value="support">Suporte (Support)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Empresa associada</label>
                <Select value={newOrgId} onValueChange={setNewOrgId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a organização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma organização (Sem empresa)</SelectItem>
                    {organizations?.map((org: any) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newRole === 'super_admin' && selectedUser.user_roles?.[0]?.role !== 'super_admin' && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex gap-3 text-xs">
                  <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Aviso Importante</span>
                    Você está promovendo este usuário ao cargo de <strong>Super Admin</strong>. Esta conta terá acesso irrestrito e poderá ler e alterar dados de todas as organizações da plataforma.
                  </div>
                </div>
              )}

              {showConfirmSuperAdmin && selectedUser.user_roles?.[0]?.role !== 'super_admin' && (
                <div className="flex items-start space-x-2.5 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs">
                  <input
                    type="checkbox"
                    id="confirm-super-admin"
                    className="h-4 w-4 mt-0.5 rounded border-amber-300 dark:border-amber-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-background"
                    checked={hasConfirmedCheckbox}
                    onChange={(e) => setHasConfirmedCheckbox(e.target.checked)}
                  />
                  <label htmlFor="confirm-super-admin" className="font-medium cursor-pointer select-none">
                    Estou ciente do risco e confirmo a promoção deste usuário a Super Admin.
                  </label>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedUser(null);
                setShowConfirmSuperAdmin(false);
                setHasConfirmedCheckbox(false);
              }}
              disabled={updateRoleMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveChanges}
              disabled={
                updateRoleMutation.isPending || 
                (newRole === 'super_admin' && !hasConfirmedCheckbox && (selectedUser?.user_roles?.[0]?.role !== 'super_admin'))
              }
            >
              {updateRoleMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
