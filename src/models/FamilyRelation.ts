export type RelationType = | 'father' | 'mother' | 'child' | 'spuse' | 'sibling' | 'grandfather' | 'grandmother' | 'grandchild';

export interface FamilyRelation {
    id?: number;
    user_id: number;
    relative_id: number;
    relation_type: RelationType;
    created_at?: Date;
    updated_at?: Date;
}
