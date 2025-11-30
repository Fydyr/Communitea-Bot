"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogInteraction = void 0;
const LogInteraction = async ([interaction], _client, next) => {
    console.log(`[${new Date().toISOString()}] Interaction: ${interaction.id} by ${interaction.user.tag}`);
    await next();
};
exports.LogInteraction = LogInteraction;
//# sourceMappingURL=Logger.js.map