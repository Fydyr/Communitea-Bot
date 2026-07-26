import { vi, type Mock } from "vitest";
import type { CommandInteraction } from "discord.js";

export interface MockInteraction {
  interaction: CommandInteraction;
  deferReply: Mock;
  editReply: Mock;
  fetchReply: Mock;
}

/**
 * Fabrique une CommandInteraction mockée pour tester une méthode de contrôleur
 * sans passer par le routage discordx.
 */
export function createMockInteraction(
  overrides: Partial<{ guildId: string | null; userId: string }> = {}
): MockInteraction {
  const deferReply = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue(undefined);
  const fetchReply = vi.fn().mockResolvedValue({ id: "reply-message" });

  const interaction = {
    guildId: overrides.guildId !== undefined ? overrides.guildId : "guild-1",
    user: { id: overrides.userId ?? "user-1" },
    deferReply,
    editReply,
    fetchReply,
  } as unknown as CommandInteraction;

  return { interaction, deferReply, editReply, fetchReply };
}
