export class WatchCarService {
  async execute(_wantedCarId: string): Promise<void> {
    // O sistema de monitoramento roda via cron job buscando WantedCar com status PENDING.
    // Esse serviço existe para manter a intenção explícita no fluxo principal.
    return;
  }
}
