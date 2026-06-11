/**
 * 业务层基础测试 (不连真实 DB, 只跑解析/纯函数/错误路径)
 */
import { describe, it, expect } from "vitest";
import { parseMentions, CreateCommentSchema } from "../src/services/commentService.js";

describe("parseMentions", () => {
  it("空字符串无 mention", () => {
    expect(parseMentions("")).toEqual([]);
  });
  it("提取单个 @user", () => {
    expect(parseMentions("hello @alice 你好")).toEqual(["alice"]);
  });
  it("提取多个 @user, 去重", () => {
    expect(parseMentions("@alice @bob @alice")).toEqual(["alice", "bob"]);
  });
  it("忽略非法字符", () => {
    expect(parseMentions("@a@b @valid_user-1 .@nope")).toEqual(["a", "b", "valid_user-1", "nope"]);
  });
  it("大小写归一", () => {
    expect(parseMentions("@Alice @ALICE @alice")).toEqual(["alice"]);
  });
});

describe("CreateCommentSchema", () => {
  it("合法入参", () => {
    const r = CreateCommentSchema.parse({
      projectId: "00000000-0000-0000-0000-000000000001",
      targetType: "panel",
      targetId: "00000000-0000-0000-0000-000000000002",
      body: "hi @bob",
    });
    expect(r.targetType).toBe("panel");
  });
  it("缺 body 失败", () => {
    expect(() =>
      CreateCommentSchema.parse({
        projectId: "00000000-0000-0000-0000-000000000001",
        targetType: "general",
      })
    ).toThrow();
  });
  it("非法 targetType 失败", () => {
    expect(() =>
      CreateCommentSchema.parse({
        projectId: "00000000-0000-0000-0000-000000000001",
        targetType: "WRONG",
        body: "x",
      })
    ).toThrow();
  });
  it("空 body 失败", () => {
    expect(() =>
      CreateCommentSchema.parse({
        projectId: "00000000-0000-0000-0000-000000000001",
        targetType: "general",
        body: "",
      })
    ).toThrow();
  });
});
