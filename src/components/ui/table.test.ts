import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Table, TBody, TD, TR } from "./table";

/**
 * The phone-card labels travel by stylesheet, not by React. This pins the
 * contract the CSS in globals.css depends on: a `data-cards` scope on the
 * table, and one `nth-child` rule per label — and nothing when there are no
 * labels, so a table nobody asked to become cards stays a table.
 *
 * createElement rather than JSX: the test runner has no JSX transform, and a
 * three-element tree does not need one.
 */
describe("Table labels", () => {
  it("writes one scoped ::before rule per column", () => {
    const html = renderToStaticMarkup(
      h(
        Table,
        { labels: ["Creator", "Fee", 'Due "soon"'] },
        h(TBody, null, h(TR, null, h(TD, null, "@ada"), h(TD, null, "₦40,000"), h(TD, null, "Friday"))),
      ),
    );

    const scope = html.match(/data-cards="([^"]+)"/)?.[1];
    expect(scope).toBeTruthy();
    expect(html).toContain("table-cards");
    expect(html).toContain(
      `[data-cards="${scope}"]>tbody>tr>td:nth-child(2)::before{content:"Fee"}`,
    );
    // A quote in a header must not end the CSS string early.
    expect(html).toContain('td:nth-child(3)::before{content:"Due \\"soon\\""}');
  });

  it("does nothing without labels", () => {
    const html = renderToStaticMarkup(
      h(Table, null, h(TBody, null, h(TR, null, h(TD, null, "plain")))),
    );
    expect(html).not.toContain("<style");
    expect(html).not.toContain("data-cards");
    expect(html).not.toContain("table-cards");
  });
});
