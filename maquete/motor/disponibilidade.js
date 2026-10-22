// Unknown, reserved, sold and blocked units must never imply availability.
export function availableUnitIds(catalog,{unverified=false}={}){
  return unverified?[]:(catalog?.units??[])
    .filter(unit=>unit.commercial?.availability==='disponivel').map(unit=>unit.id);
}
