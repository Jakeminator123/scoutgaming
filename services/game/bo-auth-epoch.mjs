// A monotonically increasing CRAIG auth epoch prevents an old BO or Lab cookie
// from becoming valid again if a changed role or password is later restored.
export function installBoAuthEpoch(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bo_auth_epochs (
      user_id INTEGER PRIMARY KEY, epoch INTEGER NOT NULL DEFAULT 0
    );
    CREATE TRIGGER IF NOT EXISTS bo_auth_epoch_update
      AFTER UPDATE OF role, salt, hash ON users
      WHEN OLD.role IS NOT NEW.role OR OLD.salt IS NOT NEW.salt OR OLD.hash IS NOT NEW.hash
    BEGIN
      INSERT INTO bo_auth_epochs (user_id, epoch) VALUES (NEW.id, 1)
        ON CONFLICT(user_id) DO UPDATE SET epoch = epoch + 1;
    END;
    CREATE TRIGGER IF NOT EXISTS bo_auth_epoch_delete
      AFTER DELETE ON users
    BEGIN
      INSERT INTO bo_auth_epochs (user_id, epoch) VALUES (OLD.id, 1)
        ON CONFLICT(user_id) DO UPDATE SET epoch = epoch + 1;
    END;
  `);
  const lookup = db.prepare('SELECT epoch FROM bo_auth_epochs WHERE user_id=?');
  return id => lookup.get(id)?.epoch ?? 0;
}
