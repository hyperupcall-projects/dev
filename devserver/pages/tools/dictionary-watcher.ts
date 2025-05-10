import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import type { PageSchemaT } from "./dictionary-watcher.server.ts";
import { Fragment } from "preact";
import { Navigation } from "#components/Navigation.ts";

let ws: WebSocket | null = null;
if ("window" in globalThis) {
  ws = new WebSocket("http://localhost:3000/ws");
  ws.addEventListener("error", console.error);
  ws.addEventListener("open", () => {
    console.info(`Opening WebSocket`);
  });
}

export function Page(a: PageSchemaT) {
  const [log, setLog] = useState("");

  useEffect(() => {
    if (!ws) {
      console.info("no ws");
      return;
    }

    const listener = (str: MessageEvent) => {
      console.info("ev", str);

      let obj;
      try {
        obj = JSON.parse(str.data);
      } catch {}

      if (obj?.type === "dictionary-watcher-log") {
        console.log("Appending to dictionary log", obj.line);
        setLog(log + obj.line + "\n");
      }
    };
    ws.addEventListener("message", listener);

    return () => ws.removeEventListener("message", listener);
  }, []);

  return html`
    <${Fragment}>
      <${Navigation} />
      <h1 class="mb-0 title">Dictionary Watcher</h1>
      <p class="mb-0">This tool watches and sync various dictionary files</p>
      <hr class="my-2" />
      <div class="content">
        <p>The following dictionary files are processed:</p>
        <ul>
          <li>
            <p>
              <b>cspell:</b> at
              <code>cat ~/.dotfiles/config/custom-words.txt</code>
            </p>
          </li>
          <li>
            <p>
              <b>LibreOffice:</b> at
              <!-- TODO: space -->
              <code>~/.config/libreoffice/4/user/wordbook/standard.dic</code>
            </p>
          </li>
        </ul>
      </div>
      <h2>Watching these files:</h2>
      ${a.fileList.map((item) => {
        return html`<p class="subtitle">${item.path}</p>`;
      })}
      <h2>Log</h2>
      <pre>
      	${log}
      </pre
      >
    <//>
  `;
}
