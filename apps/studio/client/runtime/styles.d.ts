declare module '*.module.css' { const styles: Record<string,string>; export default styles; }
// Side-effect stylesheet imports (e.g. '@xyflow/react/dist/style.css'); TypeScript 7 checks them.
declare module '*.css';
