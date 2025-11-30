"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
class UserModel {
    users = new Map();
    async findById(id) {
        return this.users.get(id);
    }
    async save(user) {
        this.users.set(user.id, user);
    }
    async delete(id) {
        return this.users.delete(id);
    }
}
exports.UserModel = UserModel;
//# sourceMappingURL=User.js.map