import { html } from "htm/preact";
import path from "node:path";
import { useEffect, useState } from "preact/hooks";
import * as v from "valibot";
import os from "node:os";
import fs from "node:fs/promises";
import type { Express } from "express";
import type { WebSocketServer } from "ws";

export type PageSchemaT = v.InferInput<typeof PageSchema>;
export const PageSchema = v.strictObject({
  fileList: v.array(
    v.strictObject({ path: v.string(), lastAccessed: v.string() }),
  ),
});

const cspellFiles = [
  path.join(os.homedir(), ".dotfiles/config/custom-words.txt"),
];

export async function PageData(): Promise<PageSchemaT> {
  const list: PageSchemaT["fileList"] = [];
  for (const file of cspellFiles) {
    list.push({
      path: file,
      lastAccessed: (await fs.stat(file)).mtime.toTimeString(),
    });
  }

  return {
    fileList: list,
  };
}

export function Api(app: Express, wss: WebSocketServer) {
  wss.on("connection", (ws) => {
    ws.on("error", console.error);
    ws.on("message", function message(data) {
      console.log("received: %s", data);
    });

    for (const dictFile of cspellFiles) {
      const signal = new AbortController().signal;
      (async () => {
        try {
          const watcher = fs.watch(dictFile, { persistent: false, signal });
          for await (const event of watcher) {
            ws.send(
              JSON.stringify({
                type: "dictionary-watcher-log",
                line: `Event "${event.eventType}" from file "${event.filename}"`,
              }),
            );
          }
        } catch (err) {
          if (err.name === "AbortError") {
            return;
          }
          throw err;
        }
      })();
    }

    ws.send("something");
  });
}
