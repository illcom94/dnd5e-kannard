import Portent from "./portent.js";
import { applyTokenDamage, createDamageList } from "../../midi-qol/module/utils.js"

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Hooks.once("setup", () => {
    setupActorClass();
    setupItemClass();
    
    Hooks.on("midi-qol.preDamageRollComplete", async (workflow) => {
    	if (workflow.item.name == "Magic Missile") {
			let defaultDamageType = workflow.item.data.data.damage?.parts[0][1] || workflow.defaultDamageType;
			let damageDetail = createDamageList(workflow.damageRoll, workflow.item, workflow.defaultDamageType);
			let dmgTotal = 0;
			for (let d of damageDetail) {
				dmgTotal += d.damage;
			}
			workflow.damageRoll = new Roll("0");
			for (let t of game.user.targets) { 
				if (game.cub.hasCondition("Magic Missile", t))
    				await game.cub.removeCondition("Magic Missile", t);
    			for (let mm = 0; mm < t.mmCount; mm++) {
    				let dmg = await applyTokenDamage(damageDetail, dmgTotal, [t], workflow.item, new Set());
    				await t.actor.applyDamage(dmg[0].hpDamage, 1);
    				let messageContent = `<hr><div style="color: black; font-size: 1em;">${t.name} takes ${dmg[0].hpDamage} from ${workflow.item.name}.</div><hr>`;
    				ChatMessage.create({content: messageContent});
    			}
    			t.mmCount = 0;
    		}
    	}
    	
    });
    
    Hooks.on("midi-qol.AttackRollComplete", async (workflow) => {
    	for (let t of workflow.hitTargets) {
    		let a = t?.actor;
    		if (a != null) {
    			if (workflow.item.data.data.actionType == "mwak") {
    				let aoa = a.data.effects.filter(ef => ef.label == "Armor of Agathys");
    				if (aoa.length > 0 && a.data.data.attributes.hp.temp != null && a.data.data.attributes.hp.temp > 0) {
	    				let armorFeat = a.items.filter(i => i.type == "feat" &&  i.name == 'Armor of Agathys Damage')[0];
	    				let damage = parseInt(armorFeat.data.data.damage.parts[0][0]);
	    				let type = armorFeat.data.data.damage.parts[0][1];
	    				let token = workflow.actor.token;
	    				if (token == null) {
	    					token = workflow.actor.data.token;
	    					token.actor = workflow.actor;
	    				}
    					let dmg = await applyTokenDamage([ { damage: damage, type: type} ], damage, [ token ], armorFeat, new Set());
    					workflow.actor.applyDamage(dmg[0].hpDamage, 1);
    					let messageContent = `<hr><div style="color: black; font-size: 1em;">${workflow.actor.name} takes ${dmg[0].hpDamage} from ${a.name}'s ${aoa[0].label}.</div><hr>`;
    					ChatMessage.create({content: messageContent});
    				}
    			}
    		}
    	}
    });
});

function setupActorClass() {
	libWrapper.register("dnd5e-kannard", "CONFIG.Actor.entityClass.prototype.longRest", 
	async function(wrapped, args = {}) {
		console.log(args);
 	    let data = await wrapped(args);
 	    //let data = await this.longRest_kannard(args);
        //if data is undefined, we did not rest.
 	    if (typeof data !== 'undefined') {
 			if (typeof this.portent === 'undefined') {
 				this.portent = new Portent(this);
			}
 			await this.portent.refresh();
    	}
        return data;
    });
}

function setupItemClass() {
    libWrapper.register("dnd5e-kannard", "CONFIG.Item.entityClass.prototype.rollDamage", 
    async function(wrapped, args = {}) //{ event = null, spellLevel = null, versatile = null } = {}) 
    { 
    	if (this.data.name == "Magic Missile") {
    		let missileCount = 2;
    		if (args.spellLevel != null && args.spellLevel > 0) {
				missileCount += args.spellLevel;
			} else {
				missileCount += itemData.level;
			}
			
			let targets = Array.from(game.user.targets);
			if (targets.length == 1) {
				targets[0].mmCount = missileCount;
			}
			else 
			{
				let mmDiag = new Dialog({
    				title: "Magic Missle Target", 
   		 			missileCount: missileCount, 
    				missilesLeft: missileCount,
    				content: `Magic Missles: ${missileCount}`, 
    				buttons: {
    					reset: {
    						label: "Reset", 
    						callback: () => {
    							mmDiag.data.missilesLeft = mmDiag.data.missileCount;
    							mmDiag.data.content = `Magic Missles: ${mmDiag.data.missileCount}`;
    							for (let t of game.user.targets) { 
    								let button = mmDiag.data.buttons[t.id];
    								if (button.mmCount > 0)
	    								game.cub.removeCondition("Magic Missile", t);
    								button.mmCount = 0;
    								button.label = `${button.token.name}: ${button.mmCount}`;
    							}
    							mmDiag.render(true);
    						}
    					},
    					done: {
    						label: "Done",
    						callback: () => {
    							if (mmDiag.missilesLeft > 0) 
    								mmDiag.render(true);
    							else {
    								for (let t of game.user.targets) { 
    									let button = mmDiag.data.buttons[t.id];
    									t.mmCount = button.mmCount;
    								}
    							}
    						}
    					}
    				}
    			});
    			
    			for (let t of game.user.targets) {
   		 			mmDiag.data.buttons[t.id] = { label: t.name, mmCount: 0, token: t, 
    				callback: () => 
    				{ 
    					if (mmDiag.data.missilesLeft > 0) {
   		 					mmDiag.data.missilesLeft--;
    						let button = mmDiag.data.buttons[t.id];
    						mmDiag.data.content = `Magic Missles: ${mmDiag.data.missilesLeft}`;
    						button.mmCount++;
    						button.label = `${t.name}: ${button.mmCount}`;
    						game.cub.addCondition("Magic Missile", button.token, { allowDuplicates: true }); 
    					}
    					mmDiag.render(true);
    				}};
    			}
    			mmDiag.render(true);
			}
    	}
    	
	    let addedHex = false;
    	let itemData = this.data.data;
    	//let oldDamage = itemData.damage.parts[0][0];
 	    let partCount = itemData.damage.parts.length;
    	if (this.data.type === "spell" && itemData.level > 0 && this.isHealing) { 
    	    if (itemData.damage.parts[partCount - 1].length == 3 && itemData.damage.parts[partCount - 1][2] == "DOL") {
    	    	itemData.damage.parts.pop();
    	    }
    		// this is a healing spell. check if they are a life cleric
			let dol = this.actor.items.filter(i => i.name == 'Disciple of Life');

			if (dol.length > 0 ) {
				let dolBonus = 2;
				if (args.spellLevel != null && args.spellLevel > 0) {
					dolBonus += args.spellLevel;
				} else {
					dolBonus += itemData.level;
				}
				itemData.damage.parts.push([`${dolBonus}`, "healing", "DOL"]);
			}
    	}
    	else if (this.hasAttack) {
    		if (this.name == "Eldritch Blast" && this.actor.items.filter(i => i.name == "Eldritch Invocations: Agonizing Blast").length > 0) {
    			if (itemData.damage.parts[0].length < 3) {
					itemData.damage.parts[0] = [itemData.damage.parts[0][0] + " + " + this.actor.data.data.abilities.cha.mod.toString(), itemData.damage.parts[0][1], "Agonizing Blast"];
    			}
    		}
    		// warlock hex
    		for (let t of game.user.targets) {
    			let a = t?.actor;
    			if (a != null) {
    				let hexes = a.data.effects.filter(ef => ef.label == "Hex");
    				for (let hex of hexes) {
    					if (hex.origin.split('.')[1] == this.actor.id) {
    						addedHex = true;
    						break;
    					}
    				}
    			}
    		}
    		// monk stuff
    		if (this.actor.items.filter(i => i.type == "feat" && i.name == "Martial Arts").length > 0) {
    			if (this.name.toLowerCase().includes("shortsword") || (this.data.data.weaponType == "simpleM" && !this.data.data.properties.two)) {
    				let uaa = this.actor.items.filter(i => i.name == "Unarmed Strike" && i.type == "weapon")[0];
    				if (parseInt(this.data.data.damage.parts[0][0].substring(2, 4)) < parseInt(uaa.data.data.damage.parts[0][0].substring(2, 4))) {
    					this.data.data.damage.parts[0][0] = 
    						uaa.data.data.damage.parts[0][0].substring(0, 4) + " " + 
    						this.data.data.damage.parts[0][0].substring(4, this.data.data.damage.parts[0][0].length);
    					console.log(this.data.data.damage.parts[0][0]);
    				}
    			}
    		}
    	}

    	let itemHasHex = itemData.damage.parts[partCount - 1].length == 3 && itemData.damage.parts[partCount - 1][2] == "Hex";
    	if (addedHex && !itemHasHex) {
  			itemData.damage.parts.push(["1d6", "necrotic", "Hex"]);
  		}
    	if (!addedHex && itemHasHex) {
    		itemData.damage.parts.pop();
    	}
    	
		let returnData =  wrapped(args);
    	return returnData;
    });
}

