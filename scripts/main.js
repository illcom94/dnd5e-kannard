import Portent from "./portent.js";
import { applyTokenDamage, createDamageList } from "../../midi-qol/src/module/utils.js"

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Hooks.once("setup", () => {
    setupActorClass();
    setupItemClass();
    
    // Hooks.on("createMeasuredTemplate", async (args) => {
//     	//alert("template created!");
//     	//console.log(args);
//     	if (typeof canvas.scene._activeAuraEffect !== 'undefined' && canvas.scene._activeAuraEffect != null) {
//      		let template = canvas.templates.get(args.data._id);
//      		let disposition = canvas.scene._activeAuraEffect[0].actor.token.disposition
//  			let effects = canvas.scene._activeAuraEffect[0].item.effects
//  			let templateEffectData = []
//  			for (let effect of effects) {
//  			   	let data = {data: duplicate(effect), parentActorId: false, parentActorLink: false, entityType: "template", entityId:template.id, casterDisposition: disposition, castLevel: canvas.scene._activeAuraEffect[0].spellLevel};
//  				data.data.origin = `Actor.${canvas.scene._activeAuraEffect[0].actor._id}.Item.${canvas.scene._activeAuraEffect[0].item._id}`;
//     				templateEffectData.push(data);
//  			}
//      		
//      		await template.setFlag("ActiveAuras", "IsAura", templateEffectData);
//  			AAhelpers.UserCollateAuras(canvas.scene._id, true, false, "spellCast");
//  			canvas.scene._activeAuraEffect = null;
//      	} 
//      	return args;
//     });
    
    Hooks.on("midi-qol.AttackRollComplete", async (workflow) => {
    	for (let t of workflow.hitTargets) {
    		let a = t?.actor;
    		if (a != null) {
    			if (workflow.item.data.data.actionType == "mwak") {
    				let aoa = a.data.effects.filter(ef => ef.data.label == "Armor of Agathys");
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
    					let messageContent = `<hr><div style="color: black; font-size: 1em;">${workflow.actor.name} takes ${dmg[0].hpDamage} from ${a.name}'s ${aoa[0].data.label}.</div><hr>`;
    					ChatMessage.create({content: messageContent});
    				}
    			}
    		}
    	}
    });
});

function setupActorClass() {
	libWrapper.register("dnd5e-kannard", "CONFIG.Actor.documentClass.prototype.longRest", 
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
    libWrapper.register("dnd5e-kannard", "CONFIG.Item.documentClass.prototype.rollDamage", 
    async function(wrapped, args = {}) //{ event = null, spellLevel = null, versatile = null } = {}) 
    {     	
	    let addedHex = false;
    	let itemData = this.data.data;
    	//let oldDamage = itemData.damage.parts[0][0];
 	    let partCount = itemData.damage.parts.length;
    	if (this.hasAttack) {
    		// warlock hex
    		for (let t of game.user.targets) {
    			let a = t?.actor;
    			if (a != null) {
    				let hexes = a.data.effects.filter(ef => ef.data.label == "Hex");
    				for (let hex of hexes) {
    					if (hex.data.origin.split('.')[1] == this.actor.id) {
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
  			itemData.damage.parts.push(["1d6[necrotic]", "necrotic", "Hex"]);
  		}
    	if (!addedHex && itemHasHex) {
    		itemData.damage.parts.pop();
    	}
    	
		let returnData =  wrapped(args);
    	return returnData;
    });
}

