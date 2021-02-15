export default class Portent {

	constructor(actor) {
		this.actor = actor;
	}

	async refresh() {
		let portentList = this.actor.items.filter(i => i.name == 'Portent')
		if (portentList.length > 0) {
		  this.portent = portentList[0];
		  this.portent.update( { data: { uses: { per: ``, value: 0 } } } );
		  
		  await this.deletePortents();
		  await this.createPortents(2);
		}
	}
	
	async deletePortents() {
		let portentRolls = this.actor.items.filter(i => i.name.includes('Portent:'));
		for (let i = 0; i < portentRolls.length; i++) {
			  await this.actor.deleteEmbeddedEntity('OwnedItem', portentRolls[i]._id);
		}
	}
	
	async createPortents(count) {
	    for (let i = 0; i < count; i++) {
			  await this.createPortent();
		}
	}
	
	async createPortent() {
		let roll = new Roll(`1d20`).roll();
		await roll.toMessage({ flavor: `Portent Roll`});
		// add the portent as a feature
		await this.actor.createOwnedItem(
		{
		  name: `Portent: ${roll.result}`, 
		  type: `feat`, 
		  img: this.portent.data.img, 
		  data: 
		  {
			   description: 
			   {
					value: `You can replace any attack roll, saving throw, or ability check made by you or a creature that you can see with this fortelling roll. You must choose to do so beofre the roll, and you can replace a roll in this way only once per turn. This roll can only be used once.`, 
					chat: `Replace an attack roll, saving throw, or ability check made by you or a creature that you can see with ${roll.result}. You must choose to do so beofre the roll, and you can replace a roll in this way only once per turn. This roll can only be used once.`
			   },
			   activation: { type: `special`, cost: 1, condition: `` },
			   uses: { value: 1, max: 1, per: `lr` }, 
			   consume: { type: `attribute`, target: this.portent.data.data.consume.target, amount: 1 }
		  }
		});
	}
} 