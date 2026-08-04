import { describe, expect, it } from "vitest";
import { convertSrtToVtt, subtitleFileToVtt } from "./subtitle.util";
describe("convertSrtToVtt", () => {
  it("converts SRT timestamps and cues", () => expect(convertSrtToVtt("1\n00:00:01,250 --> 00:00:03,000\nHello")).toContain("00:00:01.250 --> 00:00:03.000\nHello"));
  it("rejects an invalid timestamp", () => expect(() => convertSrtToVtt("1\nnope --> 00:00:03,000\nHello")).toThrow(/timestamp/i));
  it("rejects an empty subtitle", () => expect(() => convertSrtToVtt("")).toThrow(/empty/i));
  it("accepts a valid external VTT file", async () => { const file = { name: "English.vtt", text: async () => "WEBVTT\n\n00:01.000 --> 00:02.000\nHello" }; await expect(subtitleFileToVtt(file)).resolves.toMatchObject({ language: "English", fileName: "English.vtt" }); });
  it("rejects a VTT file without timed cues", async () => { const file = { name: "broken.vtt", text: async () => "WEBVTT\n\nHello" }; await expect(subtitleFileToVtt(file)).rejects.toThrow(/timed cues/i); });
});
