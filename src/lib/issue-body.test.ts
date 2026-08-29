import { describe, expect, test } from "bun:test";
import {
  formatCommentAt,
  type IssueComment,
  joinIssueBody,
  splitIssueBody,
} from "./issue-body";

const ONE: IssueComment = {
  at: "2026-08-27 23:38",
  author: "joao@staffeto.com",
  text: "Need a decision on the API shape before we estimate.",
};

const TWO: IssueComment = {
  at: "2026-08-27 23:45",
  author: "sam@staffeto.com",
  text: "Let's lock POST /signup this week.",
};

const BODY = "## Ask\n\nHello.";

const ONE_FILE = `${BODY}

## Comments

### 2026-08-27 23:38 · joao@staffeto.com

> Need a decision on the API shape before we estimate.`;

function roundTrip(md: string) {
  const s = splitIssueBody(md);
  expect(joinIssueBody(s.body, s.comments, s.leftover).trimEnd()).toBe(
    md.trimEnd(),
  );
}

describe("formatCommentAt", () => {
  test("UTC floored to the minute, no timezone suffix", () => {
    expect(formatCommentAt(new Date("2026-08-27T23:38:59.999Z"))).toBe(
      "2026-08-27 23:38",
    );
  });
});

describe("splitIssueBody / joinIssueBody", () => {
  test("no comments: whole string is the body", () => {
    const s = splitIssueBody(BODY);
    expect(s).toEqual({ body: BODY, comments: [], leftover: "" });
    expect(joinIssueBody(s.body, s.comments)).toBe(BODY);
  });

  test("one comment", () => {
    const s = splitIssueBody(ONE_FILE);
    expect(s.body).toBe(BODY);
    expect(s.comments).toEqual([ONE]);
    expect(s.leftover).toBe("");
  });

  test("two comments", () => {
    const md = joinIssueBody(BODY, [ONE, TWO]);
    const s = splitIssueBody(md);
    expect(s.comments).toEqual([ONE, TWO]);
  });

  test("last ## Comments wins", () => {
    const md = `## Ask

## Comments

still ask

## Comments

### 2026-08-27 23:38 · joao@staffeto.com

> Need a decision on the API shape before we estimate.`;
    const s = splitIssueBody(md);
    expect(s.body).toBe("## Ask\n\n## Comments\n\nstill ask");
    expect(s.comments).toEqual([ONE]);
  });

  test("unparsed tail is leftover", () => {
    const md = `${ONE_FILE}

not a comment`;
    const s = splitIssueBody(md);
    expect(s.comments).toEqual([ONE]);
    expect(s.leftover).toBe("not a comment");
  });

  test("multi-line comment uses > on every line, blank as >", () => {
    const c: IssueComment = {
      at: "2026-08-27 23:38",
      author: "a@b.com",
      text: "line one\n\nline two",
    };
    const md = joinIssueBody(BODY, [c]);
    expect(md).toContain("> line one\n>\n> line two");
    expect(splitIssueBody(md).comments[0]?.text).toBe("line one\n\nline two");
  });

  test("round-trip identity aside from trailing whitespace", () => {
    roundTrip(BODY);
    roundTrip(ONE_FILE);
    roundTrip(joinIssueBody(BODY, [ONE, TWO]));
  });

  test("no fence when comments and leftover are empty", () => {
    expect(joinIssueBody(BODY, [], "")).toBe(BODY);
    expect(joinIssueBody(BODY, [])).not.toContain("## Comments");
  });
});
