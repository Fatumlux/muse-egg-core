import type { AIProvider, OCEvent, OCPack, OCProcessResult } from "@muse-egg/oc-schema";
import { AwakeningEngine } from "./awakeningEngine.js";
import { ContinuityEngine } from "./continuityEngine.js";
import { ContextWindowEngine } from "./contextWindowEngine.js";
import { EventBus } from "./eventBus.js";
import { GrowthProposalEngine } from "./growthProposalEngine.js";
import { GrowthJournalEngine } from "./growthJournalEngine.js";
import { GuardEngine } from "./guardEngine.js";
import { LifeStateEngine } from "./lifeStateEngine.js";
import { LoreEngine } from "./loreEngine.js";
import { MemoryEngine } from "./memoryEngine.js";
import { ReactionEngine } from "./reactionEngine.js";
import { ResponseEngine } from "./responseEngine.js";
import { ResponseQualityEngine } from "./responseQualityEngine.js";
import { SelfGrowthEngine } from "./selfGrowthEngine.js";
import { SkillEngine } from "./skillEngine.js";
import { createEvent, type OCEventInput } from "./utils.js";

export interface OCEngineOptions {
  aiProvider?: AIProvider;
}

export class OCEngine {
  readonly eventBus = new EventBus();
  private memoryEngine: MemoryEngine;
  private continuityEngine: ContinuityEngine;
  private contextWindowEngine: ContextWindowEngine;
  private loreEngine: LoreEngine;
  private guardEngine: GuardEngine;
  private reactionEngine: ReactionEngine;
  private skillEngine: SkillEngine;
  private awakeningEngine: AwakeningEngine;
  private responseEngine: ResponseEngine;
  private selfGrowthEngine: SelfGrowthEngine;
  private growthProposalEngine: GrowthProposalEngine;
  private growthJournalEngine: GrowthJournalEngine;
  private lifeStateEngine: LifeStateEngine;
  private responseQualityEngine: ResponseQualityEngine;

  constructor(private pack: OCPack, private readonly options: OCEngineOptions = {}) {
    this.memoryEngine = new MemoryEngine(pack);
    this.continuityEngine = new ContinuityEngine(pack);
    this.contextWindowEngine = new ContextWindowEngine(pack);
    this.loreEngine = new LoreEngine(pack);
    this.guardEngine = new GuardEngine(pack);
    this.reactionEngine = new ReactionEngine(pack);
    this.skillEngine = new SkillEngine(pack);
    this.awakeningEngine = new AwakeningEngine(pack);
    this.selfGrowthEngine = new SelfGrowthEngine(pack);
    this.growthProposalEngine = new GrowthProposalEngine(pack);
    this.growthJournalEngine = new GrowthJournalEngine(pack);
    this.lifeStateEngine = new LifeStateEngine(pack);
    this.responseQualityEngine = new ResponseQualityEngine(pack);
    this.responseEngine = new ResponseEngine(
      pack,
      this.reactionEngine,
      this.guardEngine,
      this.loreEngine,
      this.skillEngine,
      this.memoryEngine,
      options.aiProvider
    );
  }

  currentPack(): OCPack {
    return this.pack;
  }

  updatePack(pack: OCPack): void {
    this.pack = pack;
    this.memoryEngine = new MemoryEngine(pack);
    this.continuityEngine = new ContinuityEngine(pack);
    this.contextWindowEngine = new ContextWindowEngine(pack);
    this.loreEngine = new LoreEngine(pack);
    this.guardEngine = new GuardEngine(pack);
    this.reactionEngine = new ReactionEngine(pack);
    this.skillEngine = new SkillEngine(pack);
    this.awakeningEngine = new AwakeningEngine(pack);
    this.selfGrowthEngine = new SelfGrowthEngine(pack);
    this.growthProposalEngine = new GrowthProposalEngine(pack);
    this.growthJournalEngine = new GrowthJournalEngine(pack);
    this.lifeStateEngine = new LifeStateEngine(pack);
    this.responseQualityEngine = new ResponseQualityEngine(pack);
    this.responseEngine = new ResponseEngine(
      pack,
      this.reactionEngine,
      this.guardEngine,
      this.loreEngine,
      this.skillEngine,
      this.memoryEngine,
      this.options.aiProvider
    );
  }

  async processEvent(input: OCEventInput | OCEvent): Promise<OCProcessResult> {
    const event = isOCEvent(input)
      ? input
      : createEvent(input);

    await this.eventBus.emit(event);
    const memory = await this.memoryEngine.recordEvent(event, this.options.aiProvider);
    const selfGrowth = this.selfGrowthEngine.evaluate(event);
    const awakening = await this.awakeningEngine.evaluate(event);
    const context = this.contextWindowEngine.snapshotFor(event);
    const responseResult = await this.responseEngine.generate(event, context);
    const growthProposals = this.growthProposalEngine.evaluate(event, selfGrowth);
    const quality = this.responseQualityEngine.evaluate(event, responseResult.response);
    const lifeState = this.lifeStateEngine.update(event, awakening, selfGrowth, Boolean(responseResult.response?.guarded));

    const result: OCProcessResult = {
      event,
      response: responseResult.response,
      awakening,
      memory,
      selfGrowth,
      growthProposals,
      quality,
      lifeState,
      guardRuleIds: responseResult.guardRules.map((rule) => rule.id)
    };
    result.growthJournal = await this.growthJournalEngine.record(result);
    await this.continuityEngine.persist(result);
    this.contextWindowEngine.recordResult(result);
    return result;
  }
}

function isOCEvent(input: OCEventInput | OCEvent): input is OCEvent {
  return (
    typeof input.id === "string" &&
    typeof input.timestamp === "string" &&
    typeof input.platform === "string" &&
    typeof input.payload === "object" &&
    input.payload !== null
  );
}
