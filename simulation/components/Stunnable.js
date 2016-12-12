function Stunnable() {}

Stunnable.Schema = 
"<a:help>Deals with unit that can only be knocked out.</a:help>" +
"<element name='RespawnTime' a:help='Time in seconds before the knocked out unit gets back up when allies are nearby'>" +
	"<ref name='positiveDecimal'/>" +
"</element>";

Stunnable.prototype.Init = function() {
	this.alliedUnitsQuery = undefined;
	this.respawnTime = +this.template.RespawnTime;
	this.targetUnits = [];
	this.timer = undefined;
};

Stunnable.prototype.SetupRangeQuery = function() {
	let cmpAttack = Engine.QueryInterface(this.entity, IID_Attack);
	if (!cmpAttack)
		return;

	let cmpPlayer = QueryOwnerInterface(this.entity);
	if (!cmpPlayer)
		return;

	let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
	if (this.alliedUnitsQuery)
	{
		cmpRangeManager.DestroyActiveQuery(this.alliedUnitsQuery);
		this.alliedUnitsQuery = undefined;
	}

	let alliedUnits = cmpPlayer.GetAllies();
	if (alliedUnits.length && alliedUnits[0] === 0)
		alliedUnits.shift(); // remove gaia

	if (!alliedUnits.length)
		return;

	let range = cmpAttack.GetRange(attackType);
	this.alliedUnitsQuery = cmpRangeManager.CreateActiveParabolicQuery(
			this.entity, range.min, range.max, range.elevationBonus,
			enemies, IID_DamageReceiver, cmpRangeManager.GetEntityFlagMask("normal"));

	cmpRangeManager.EnableActiveQuery(this.alliedUnitsQuery);
};

Stunnable.prototype.StartTimer = function() {
	if (this.timer)
		return;

	let cmpAttack = Engine.QueryInterface(this.entity, IID_Attack);
	if (!cmpAttack)
		return;

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	let attackTimers = cmpAttack.GetTimers(attackType);

	//TODO : Change that to fill the recovery time of the unit.
	//this.timer = cmpTimer.SetInterval(this.entity, IID_Stunnable, "FireArrows", attackTimers.prepare, attackTimers.repeat / roundCount, null);
};

Stunnable.prototype.OnDestroy = function() {
	if (this.timer)
	{
		let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
		cmpTimer.CancelTimer(this.timer);
		this.timer = undefined;
	}

	// Clean up range queries
	let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
	if (this.alliedUnitsQuery)
		cmpRangeManager.DestroyActiveQuery(this.alliedUnitsQuery);

};

Stunnable.prototype.OnDiplomacyChanged = function(msg) {
	if (!IsOwnedByPlayer(msg.player, this.entity))
		return;

	// Remove maybe now allied/neutral units
	this.targetUnits = [];
	this.SetupRangeQuery();
};

Stunnable.prototype.OnOwnershipChanged = function(msg) {
	this.targetUnits = [];
	this.SetupRangeQuery();
};

Stunnable.prototype.OnRangeUpdate = function(msg) {

	let cmpAttack = Engine.QueryInterface(this.entity, IID_Attack);
	if (!cmpAttack)
		return;

	// Target enemy units except non-dangerous animals
	if (msg.tag != this.enemyUnitsQuery)
		return;

	// Add new targets
	for (let entity of msg.added)
		if (cmpAttack.CanAttack(entity))
			this.targetUnits.push(entity);

	// Remove targets outside of vision-range
	for (let entity of msg.removed)
	{
		let index = this.targetUnits.indexOf(entity);
		if (index > -1)
			this.targetUnits.splice(index, 1);
	}

	if (this.targetUnits.length)
		this.StartTimer();
};

Engine.RegisterComponentType(IID_Stunnable, "Stunnable", Stunnable);