import { personsRepository } from './persons.repository';
import { TreeSubgraphFilter } from './persons.types';
import { filterTreeSubgraph } from './tree-subgraph.service';

/** Default filter selaras FE buildPerspectiveViewConfig (map / events / memoriam). */
export const PERSPECTIVE_VIEW_DEFAULTS: TreeSubgraphFilter = {
  lineage: 'both',
  generationsUp: 4,
  showSpouses: true,
  showSiblings: true,
  showChildren: true,
};

export async function getVisiblePersonIds(
  familyId: number,
  focusPersonId: number,
  selfPersonId: number,
  filter: TreeSubgraphFilter = PERSPECTIVE_VIEW_DEFAULTS,
): Promise<Set<number>> {
  const graph = await personsRepository.findGraphNodes(familyId);
  const { visibleIds } = filterTreeSubgraph(focusPersonId, selfPersonId, graph, filter);
  return visibleIds;
}
