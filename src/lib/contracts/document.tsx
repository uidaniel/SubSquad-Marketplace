import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatNaira, type Kobo } from "@/lib/money";

/**
 * The creator agreement, as a PDF.
 *
 * This is the document a creator would take to a lawyer, or show a brand that
 * disputes what was agreed, so it is written to be read by them rather than by
 * us. Three rules follow from that:
 *
 *   · The five terms that differ per deal — who, what, how much, by when, and
 *     for how long the brand may use it — sit in a table at the top, before any
 *     prose. Those are the only terms anybody actually checks.
 *   · The clauses are in plain English, numbered, and short. A clause a creator
 *     cannot understand is one they cannot rely on, and this contract exists
 *     mostly to protect the party with less power.
 *   · Acceptance is recorded on the face of the document — name, phone, time
 *     and IP. An agreement you cannot prove was accepted is not worth having.
 *
 * Deliberately no logo image. It renders identically everywhere, the file stays
 * small enough to send over WhatsApp on a Nigerian data plan, and nothing
 * breaks if an asset moves.
 */

const INK = "#141414";
const INK_2 = "#555555";
const LINE = "#dddddd";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    lineHeight: 1.6,
    color: INK,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 10,
    marginBottom: 22,
  },
  wordmark: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  reference: { fontSize: 9, color: INK_2 },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  subtitle: { fontSize: 10, color: INK_2, marginBottom: 22 },

  termsTable: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 3,
    marginBottom: 24,
  },
  termRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  termRowLast: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  termLabel: { width: 130, color: INK_2 },
  termValue: { flex: 1, fontFamily: "Helvetica-Bold" },

  feeBox: {
    backgroundColor: "#f5f5f3",
    padding: 14,
    borderRadius: 3,
    marginBottom: 24,
  },
  feeLabel: { fontSize: 9, color: INK_2, marginBottom: 2 },
  feeAmount: { fontSize: 22, fontFamily: "Helvetica-Bold" },
  feeNote: { fontSize: 9, color: INK_2, marginTop: 4 },

  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    marginBottom: 8,
  },
  clause: { marginBottom: 9, flexDirection: "row" },
  clauseNumber: { width: 20, fontFamily: "Helvetica-Bold" },
  clauseBody: { flex: 1 },

  signature: {
    marginTop: 26,
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingTop: 12,
  },
  signatureRow: { flexDirection: "row", marginBottom: 3 },
  signatureLabel: { width: 130, color: INK_2 },

  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: INK_2,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export interface ContractData {
  reference: string;
  creatorName: string;
  creatorHandle: string;
  creatorPhone: string | null;
  brandName: string;
  /** The agency running it, when there is one. The creator contracts with SubSquad either way. */
  agencyName: string | null;
  campaignName: string | null;
  deliverable: string;
  feeKobo: Kobo;
  /** What the creator actually receives, after any fee they agreed to absorb. */
  takeHomeKobo: Kobo;
  deadline: string;
  usageRightsDays: number;
  disclosureTag: string;
  acceptedAt: string | null;
  acceptedIp: string | null;
}

function Term({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={last ? styles.termRowLast : styles.termRow}>
      <Text style={styles.termLabel}>{label}</Text>
      <Text style={styles.termValue}>{value}</Text>
    </View>
  );
}

function Clause({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={styles.clause}>
      <Text style={styles.clauseNumber}>{n}.</Text>
      <Text style={styles.clauseBody}>{children}</Text>
    </View>
  );
}

export function ContractDocument({ data }: { data: ContractData }) {
  const feeDiffers = data.takeHomeKobo !== data.feeKobo;

  return (
    <Document
      title={`SubSquad creator agreement ${data.reference}`}
      author="SubSquad Technologies Ltd"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>SubSquad</Text>
          <Text style={styles.reference}>{data.reference}</Text>
        </View>

        <Text style={styles.title}>Creator agreement</Text>
        <Text style={styles.subtitle}>
          Between {data.creatorName} (&quot;the creator&quot;) and SubSquad
          Technologies Ltd, acting for {data.brandName}
          {data.agencyName ? ` through ${data.agencyName}` : ""}.
        </Text>

        {/* The fee, alone and large. It is the term most likely to be
            misremembered, and the one a dispute usually turns on. */}
        <View style={styles.feeBox}>
          <Text style={styles.feeLabel}>The creator will be paid</Text>
          <Text style={styles.feeAmount}>{formatNaira(data.takeHomeKobo)}</Text>
          <Text style={styles.feeNote}>
            Held in escrow by SubSquad from the date of this agreement. Released
            within 7 days of the content being published and verified.
            {feeDiffers
              ? ` Agreed fee ${formatNaira(data.feeKobo)}, less the platform fee the creator agreed to bear.`
              : ""}
          </Text>
        </View>

        <View style={styles.termsTable}>
          <Term label="Brand" value={data.brandName} />
          {data.campaignName && (
            <Term label="Campaign" value={data.campaignName} />
          )}
          <Term label="Creator" value={`${data.creatorName} (@${data.creatorHandle})`} />
          <Term label="Deliverable" value={data.deliverable} />
          <Term label="Publish by" value={data.deadline} />
          <Term label="Disclosure" value={`${data.disclosureTag} in the first line of the caption`} />
          <Term
            label="Usage rights"
            value={`${data.usageRightsDays} days, organic, on the brand's own channels`}
            last
          />
        </View>

        <Text style={styles.sectionTitle}>Terms</Text>

        <Clause n={1}>
          The creator will produce and publish the deliverable above by the date
          shown, meeting the brief they were given.
        </Clause>
        <Clause n={2}>
          The caption must carry {data.disclosureTag} in its first line. This is
          required by ARCON and is not a SubSquad preference. Content published
          without it has not met this agreement.
        </Clause>
        <Clause n={3}>
          The fee is held in escrow by SubSquad before the creator is contacted.
          It is released to the creator within 7 days of the content being
          published and verified. If the brand withdraws after the creator has
          delivered, the creator is paid in full regardless.
        </Clause>
        <Clause n={4}>
          The brand may request one revision. The creator has 48 hours from the
          request to submit a revised version. The fee is unaffected.
        </Clause>
        <Clause n={5}>
          If the brand rejects content that meets the brief, SubSquad reviews it
          and the creator is paid from the dispute reserve while that review
          takes place. SubSquad&apos;s decision is on the evidence of the brief
          and the content, and is final between the parties.
        </Clause>
        <Clause n={6}>
          The brand may use the content organically on its own channels for{" "}
          {data.usageRightsDays} days from publication. Paid promotion,
          whitelisting and use beyond that period require a separate agreement
          and a separate fee.
        </Clause>
        <Clause n={7}>
          The creator keeps ownership of the content and may keep it on their
          own channels indefinitely.
        </Clause>
        <Clause n={8}>
          If the creator does not deliver by the date above and has not agreed a
          new date in writing, the fee returns to the brand and the non-delivery
          is recorded on the creator&apos;s public SubSquad record.
        </Clause>
        <Clause n={9}>
          Either party may end this agreement before the creator begins work.
          Once work has been submitted, clauses 3 to 5 apply.
        </Clause>
        <Clause n={10}>
          This agreement is governed by the laws of the Federal Republic of
          Nigeria.
        </Clause>

        <View style={styles.signature}>
          <Text style={styles.sectionTitle}>Accepted by the creator</Text>
          <View style={styles.signatureRow}>
            <Text style={styles.signatureLabel}>Name</Text>
            <Text>{data.creatorName}</Text>
          </View>
          {data.creatorPhone && (
            <View style={styles.signatureRow}>
              <Text style={styles.signatureLabel}>Verified number</Text>
              <Text>{data.creatorPhone}</Text>
            </View>
          )}
          <View style={styles.signatureRow}>
            <Text style={styles.signatureLabel}>Accepted at</Text>
            <Text>
              {data.acceptedAt
                ? new Date(data.acceptedAt).toUTCString()
                : "Not yet accepted"}
            </Text>
          </View>
          {data.acceptedIp && (
            <View style={styles.signatureRow}>
              <Text style={styles.signatureLabel}>From IP</Text>
              <Text>{data.acceptedIp}</Text>
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>
            SubSquad Technologies Ltd · RC 1234567 · Victoria Island, Lagos
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
