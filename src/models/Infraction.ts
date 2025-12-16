export enum InfractionType {
  WARN = "WARN",
  KICK = "KICK",
  BAN = "BAN",
  TIMEOUT = "TIMEOUT",
  UNBAN = "UNBAN",
}

export interface Infraction {
  id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  type: InfractionType;
  reason: string;
  timestamp: Date;
  expiresAt?: Date;
  active: boolean;
}

class InfractionModel {
  private infractions: Map<string, Infraction> = new Map();
  private counter: number = 0;

  generateId(): string {
    this.counter++;
    return `INF-${Date.now()}-${this.counter}`;
  }

  create(infraction: Omit<Infraction, "id" | "timestamp" | "active">): Infraction {
    const newInfraction: Infraction = {
      ...infraction,
      id: this.generateId(),
      timestamp: new Date(),
      active: true,
    };
    this.infractions.set(newInfraction.id, newInfraction);
    return newInfraction;
  }

  findById(id: string): Infraction | undefined {
    return this.infractions.get(id);
  }

  findByUserId(userId: string): Infraction[] {
    return Array.from(this.infractions.values()).filter(
      (inf) => inf.userId === userId
    );
  }

  findActiveByUserId(userId: string): Infraction[] {
    return Array.from(this.infractions.values()).filter(
      (inf) => inf.userId === userId && inf.active
    );
  }

  findByGuildId(guildId: string): Infraction[] {
    return Array.from(this.infractions.values()).filter(
      (inf) => inf.guildId === guildId
    );
  }

  findWarningsByUserId(userId: string, guildId: string): Infraction[] {
    return Array.from(this.infractions.values()).filter(
      (inf) =>
        inf.userId === userId &&
        inf.guildId === guildId &&
        inf.type === InfractionType.WARN &&
        inf.active
    );
  }

  update(id: string, updates: Partial<Infraction>): Infraction | undefined {
    const infraction = this.infractions.get(id);
    if (!infraction) return undefined;

    const updated = { ...infraction, ...updates };
    this.infractions.set(id, updated);
    return updated;
  }

  deactivate(id: string): boolean {
    const infraction = this.infractions.get(id);
    if (!infraction) return false;

    infraction.active = false;
    this.infractions.set(id, infraction);
    return true;
  }

  deleteById(id: string): boolean {
    return this.infractions.delete(id);
  }

  getAll(): Infraction[] {
    return Array.from(this.infractions.values());
  }

  clearExpired(): number {
    const now = new Date();
    let count = 0;

    for (const [id, infraction] of this.infractions.entries()) {
      if (infraction.expiresAt && infraction.expiresAt < now && infraction.active) {
        infraction.active = false;
        this.infractions.set(id, infraction);
        count++;
      }
    }

    return count;
  }
}

export default new InfractionModel();
