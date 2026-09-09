import { describe, expect, test } from "bun:test";
import { watchMailMessage } from "./watch-mail";

describe("watch mail", () => {
  test("escapes user content, addresses one recipient, and links to the card and preferences", () => {
    const mail = watchMailMessage(
      {
        id: "id",
        token: "token",
        to: "watcher@example.test",
        title: '<script>alert("x")</script>\nMoved',
        body: "A & B\nNOW → DONE",
        path: "/p/demo/b/backlog/c/24",
      },
      "https://cardstock.example.test",
    );
    expect(mail.to).toEqual(["watcher@example.test"]);
    expect(mail.subject).not.toContain("\n");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("A &amp; B<br>");
    expect(mail.text).toContain(
      "https://cardstock.example.test/p/demo/b/backlog/c/24",
    );
    expect(mail.html).toContain("/profile#profile-notifications");
  });
});
