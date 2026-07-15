import {
  decodeFlatScenes,
  encodeIndentedScenes,
  formatSceneNumber,
  type NumberedScene,
  numberScenes,
} from "src/model/project-utils";
import { type IndentedScene } from "src/model/types";

/** Provides API access to useful Inkwell-specific functions. */
export class InkwellAPI {
  /**
   * Encodes a list of indented scenes into a flat array of strings using
   * the `> ` prefix convention introduced in Inkwell v3. This matches what
   * is written to an index file's `scenes:` frontmatter.
   *
   * For example, the input:
   *
   * ```js
   * [
   *  {title: "first", indent: 0},
   *  {title: "second", indent: 1},
   *  {title: "third", indent: 0}
   * ]
   * ```
   *
   * produces:
   *
   * ```js
   * ["first", "> second", "third"]
   * ```
   *
   * @param scenes Array of `{title, indent}` scene objects.
   * @returns Flat array of strings safe to write as YAML frontmatter.
   */
  public encodeIndentedScenes(scenes: IndentedScene[]): string[] {
    return encodeIndentedScenes(scenes);
  }

  /**
   * Decodes a flat array of scene strings (using the `> ` prefix
   * convention) back into `IndentedScene` objects. The inverse of
   * `encodeIndentedScenes`.
   *
   * @param items Flat array of strings (as read from `scenes:` frontmatter).
   * @returns Array of `{title, indent}` scene objects.
   */
  public decodeFlatScenes(items: unknown): IndentedScene[] {
    return decodeFlatScenes(items);
  }

  /**
   * Annotates an array of indented scenes with a `numbering` property, an array of `number`s.
   * This property corresponds to each scene’s “number,” where a scene with no indent is numbered `[1]` or `[2]` or `[3]`, etc.
   * while an indented scene might be numbered `[1, 1, 2]` to indicate scene 1.1.2, the second scene at a third indent under the first scene and first subscene.
   * @param scenes Array of `IndentedScene`s to annotate.
   * @returns Array of `NumberedScene`s, which are `IndentedScene`s with an added `numbering` property of type `number[]`.
   */
  public scenesWithNumberings(scenes: IndentedScene[]): NumberedScene[] {
    return numberScenes(scenes);
  }

  /**
   * Given an array of numbers, returns the string corresponding to those numbers formatted as scene/subscene “numbering.”
   * For example, `[1, 1, 2]` becomes `"1.1.2"`.
   * @param numbering Array of numbers corresponding a scene’s “number.”
   * @returns Formatted numbering for display.
   */
  public formatSceneNumbering(numbering: number[]): string {
    return formatSceneNumber(numbering);
  }
}
