/**
 * PerformanceMonitor.ts
 * Utilitário para monitoramento de tempo de execução de queries e RPCs.
 * Alinha-se com as boas práticas de observabilidade no Frontend.
 */

const IS_DEV = import.meta.env.DEV;

export const PerformanceMonitor = {
  timers: new Map<string, number>(),

  /**
   * Inicia o cronômetro para uma operação específica.
   * @param label Identificador único para a operação
   */
  startTimer(label: string) {
    this.timers.set(label, performance.now());
  },

  /**
   * Finaliza o cronômetro e avalia a duração.
   * Se passar de 500ms, emite um aviso no console.
   * @param label Identificador da operação
   * @returns A duração em milissegundos
   */
  endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      if (IS_DEV) console.warn(`Timer '${label}' finalizado sem ter sido iniciado.`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(label);

    this.logSlowQuery(label, duration);

    // Em modo de desenvolvimento, também podemos logar durações normais para debug opcional.
    // if (IS_DEV && duration <= 500) {
    //   console.debug(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
    // }

    return duration;
  },

  /**
   * Verifica se a query demorou mais que 500ms e alerta.
   * @param queryName Nome ou label da query
   * @param durationMs Tempo total em milissegundos
   */
  logSlowQuery(queryName: string, durationMs: number) {
    if (durationMs > 500) {
      console.warn(`[SLOW QUERY WARNING] A operação '${queryName}' demorou ${durationMs.toFixed(2)}ms! (Limite aceitável: 500ms)`);
    }
  }
};
