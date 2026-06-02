import { Schema, model, models } from "mongoose";

const AgentCorrectionSchema = new Schema(
  {
    garmentId: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    agentProposed: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    changed: { type: Schema.Types.Mixed },
    images: [{ type: String }],
    source: { type: String, default: "agent-feedback" },
  },
  { timestamps: true }
);

AgentCorrectionSchema.index({ garmentId: 1 }, { unique: true });

export default models.AgentCorrection || model("AgentCorrection", AgentCorrectionSchema);
