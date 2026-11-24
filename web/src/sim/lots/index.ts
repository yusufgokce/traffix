import { buildLot, type LotSpec } from "../layout";
import { costcoKirkham } from "./costco-kirkham";
import { demoLot } from "./demo";

export const lotSpecs: LotSpec[] = [costcoKirkham, demoLot];

export function getLot(id: string) {
  const spec = lotSpecs.find((l) => l.id === id) ?? lotSpecs[0];
  return buildLot(spec);
}
