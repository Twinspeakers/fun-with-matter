import { useEffect } from "react";
import appShell from "./app-shell.html?raw";
import { boot } from "./boot";

export default function App() {
  useEffect(() => {
    boot();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: appShell }} />;
}
