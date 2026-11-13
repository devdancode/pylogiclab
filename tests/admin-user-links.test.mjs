import assert from "node:assert/strict";
import { test } from "node:test";
import { adminUserHref, adminUsersApiPath } from "../lib/routes.ts";
import proxy from "../api/service.mjs";

test("links da administração mantêm o ID na consulta e na atualização da ficha", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push([options.method, new URL(url).pathname]);
    return Response.json({ ok: true });
  });
  for (const id of ["sb:53e28829-aca5-48c1-822d-5998c02368e4", "sites:legacy-user"]) {
    const link = new URL(adminUserHref(id), "https://portal.test");
    const segment = link.pathname.split("/").pop();
    const path = "/api/" + adminUsersApiPath(segment);
    for (const method of ["GET", "POST"]) {
      const res = {
        setHeader() {},
        status(code) { assert.equal(code, 200); return this; },
        send() {},
      };
      await proxy({
        method, url: path, headers: { "content-type": "application/json" },
        body: method === "POST" ? { role: "aluno", active: 1 } : undefined,
      }, res);
      assert.deepEqual(requests.pop(), [method, "/api/admin/users/" + encodeURIComponent(id)]);
    }
  }
});

test("a lista de usuários continua acessível sem ID", () => {
  assert.equal(adminUsersApiPath(), "admin/users");
});
