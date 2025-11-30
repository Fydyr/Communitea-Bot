export interface User {
    id: string;
    username: string;
    discriminator: string;
    createdAt: Date;
}
export declare class UserModel {
    private users;
    findById(id: string): Promise<User | undefined>;
    save(user: User): Promise<void>;
    delete(id: string): Promise<boolean>;
}
//# sourceMappingURL=User.d.ts.map