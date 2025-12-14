import { ArgsOf, GuardFunction } from "discordx";
import { LoggerService } from "../services/LoggerService";

export const LogInteraction: GuardFunction<ArgsOf<"interactionCreate">> = async (
  [interaction],
  _client,
  next
) => {
  await LoggerService.info(`🔔 Interaction: ${interaction.id} par ${interaction.user.tag}`);
  await next();
};
