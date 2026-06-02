import { Schema, model, models } from "mongoose";

const AgentProposalSchema = new Schema(
  {
    garmentId: { type: String, required: true },
    runId: { type: String, required: true },
    runAt: { type: Date, required: true },
    model: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    proposal: { type: Schema.Types.Mixed },
    status: { type: String, enum: ["pending", "accepted", "skipped"], default: "pending" },
  },
  { timestamps: true }
);

AgentProposalSchema.index({ garmentId: 1, runId: 1 }, { unique: true });
AgentProposalSchema.index({ status: 1 });
AgentProposalSchema.index({ runId: 1 });

export default models.AgentProposal || model("AgentProposal", AgentProposalSchema);
