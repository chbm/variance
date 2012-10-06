var http = require('http'),
		resourceful = require('resourceful'),
		backofficeful = require('../index.js'),
		repl = require('repl');


var Creator = resourceful.define('creator', function () {
	this.string('name');

	this.object('bag');
});


var Creature = resourceful.define('creature', function () {
	this.string('name');
  this.string('diet');
  this.bool('vertebrate');
  this.array('belly');

	this.parent(Creator);

  this.timestamps();

  this.prototype.feed = function (food) {
    this.belly.push(food);
  };
});

Creator.create({id: 'dawkins', name: 'dawkins'});

Creator.createCreature('dawkins', 
				{id: resourceful.uuid.v4(), diet: 'good', name: 'dog', vertebrate: true, belly: []},
				console.log);

var backoffice = backofficeful.createServer([Creature, Creator]);
backoffice.listen(8010);

var r = repl.start({prompt: 'node>'});
r.context.Creature = Creature;
r.context.Creator = Creator;
r.context.B = backoffice;
