// Shared error identity for Studio services and presentation selection.
export class StudioError extends Error {
  constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; }
}
