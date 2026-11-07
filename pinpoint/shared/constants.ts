// Constants shared by the client, the server and the tooling. F02 adds the game's constants.

/** The server's port inside the container (`PORT` overrides it). */
export const DEFAULT_PORT = 3000;

/**
 * Development ports (DECISIONS 5): the server on 3010 and Vite on 5180, clear of Buzzr and
 * Sketchy (3000, 5173) and the hub (4500, 4501), which Kim may run at the same time.
 */
export const DEV_SERVER_PORT = 3010;
export const DEV_CLIENT_PORT = 5180;
