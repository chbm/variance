
var socket = io.connect('/');
var router = Router();


var datacache = {}; // XXX dont like this

var createElem = function(x) { return window.document.createElement(x) };

function lowerplural (str) {
	return str.toLowerCase() + 's';
}

router.init();
//router.scope = '/'; // director bug ? 

function fakeGuid() {
    var S4 = function() {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

function someError (err) {
	console.error(err);
}

function createResourceHeader (schema) {
	var div = createElem('div');
	div.id = schema.name + '-header';
	div.innerHTML = '<h3>'+schema.name+'</h3>';
	return div;
}

function getValueFromInput (input) {
	var value = null;
	switch(input.type) {
		case 'text':
		case 'number':
			value = input.value;
			break;
		case 'checkbox':
			value = input.checked;
			break;
		case 'datetime':
			value = input.valueAsNumber;
			break;	
	}
	return value;
}

function getDataFromForm (form) {
	var fields = {};
	var fl = form.querySelectorAll('input');
	for (var i = 0; i < fl.length; i++) {
		fields[fl[i].name] = getValueFromInput(fl[i]); 
	};
	fields.id = fields.id || fakeGuid();

	return fields;
}

function updateResource (form) {
	
	makeResourceEditable(form, false);

	socket.emit(form.dataset.resource, 'update', getDataFromForm(form), function (err, resource) {
		if(err) {
			return someError(err);
		}

		console.log('--- saved'); // TODO better feedback
	});

	return false;
}

function makeResourceEditable (id, editable) {
	var form = document.getElementById(id);
	var fl = form.querySelectorAll('input');
	for (var i = 0; i < fl.length; i++) {
		if(fl[i].name !== 'id') {
			fl[i].disabled = !editable;
		}
	};
	var b = form.querySelector('button');
	if(editable) {
		b.innerText = 'Save';
		b.onclick = function() { updateResource(id); return false;};
	} else {
		b.innerText = 'Edit';
		b.onclick = function() { makeResourceEditable(id, true); return false;};
	}
	
	return false;
}

function showJsonEditor (json, saveRes) {
	var outerdiv = createElem('div'),
			innerdiv = createElem('div');

	innerdiv.className = 'json-editor';
	$(innerdiv).jsonEditor(json);
	outerdiv.appendChild(innerdiv);
	$(outerdiv).dialog({
		autoOpen: true,
		modal: true,
		height: document.height * 0.9,
		width: document.width * 0.9,
		buttons: {
			"Save": function(json) { saveRes(json); $(this).dialog("close");},
			"Cancel": function () {$(this).dialog( "close" );}
		}
	});
	
}

function editArray (name, id, property) {
	
}

function templateForProperty (schema, name, prop) {
	var openinput = '<input class="span12" disabled ';
	var types = {
		'string': [ 'name="', name, '" type="text" value="{{',name,'}}" '],
		'boolean': [ 'name="', name, '" type="checkbox" checked="{{',name,'}}" '],
		'number': [ ' name="', name, '" type="number" value="{{',name,'}}" '],
		'unix-time': [ ' name="', name, '" type="datetime" valueAsNumber="{{',name,'}}" '],
		'array': [ ' name="', name, '" type="button" value="Edit Array" onclick="{{fgenerator}}(this); return false;" ' ],
		'object': [ ' name="', name, '" type="button" value="Edit Object" onclick="{{fgenerator}}(this); return false;"'],
	};
	types['null'] = types['string'];

	var template = ['<div class="control-group"><label class="control-label" for="', name, '">', name, '</label> <div class="controls">', openinput ];

	var t = (typeof prop.type === 'string') ? prop.type : 'string'; // XXX need a better idea
	template.push.apply(template, types[t]);
	if(prop.required || prop.name === 'id') {
		template.push(' required ');
	}
	template.push('/> </div></div>');
	return template.join('');
}


function formTemplateFromSchema (schema) {
	var template = [' <form id="{{id}}" data-resource="',schema.name.toLowerCase(),'s" action="#" class="form-horizontal"><fieldset class="well">'];

	template.push(templateForProperty(schema, 'id', {type: 'string'}));
	for (var p in schema.properties) {
		if(!schema.properties[p].private) {
			template.push( templateForProperty(schema, p, schema.properties[p]) );
		}
	};
	template.push('<div class="form-actions"><button class="btn-primary" type="none" name="save" onclick="makeResourceEditable(\'{{id}}\', true); return false;">Edit</button></div></fieldset></form>');
	
	return template.join('');
}

function templateFromSchema (schema) {
	var formtemplate = formTemplateFromSchema(schema);
	var template = ['<div class="navbar"><div class="navbar-inner"><div class="container-fluid"><a class="btn" href="#" id="create-new-', schema.name,'"><i class="icon-plus icon-white"></i></a><span class="brand">', schema.name,'</span></div></div></div> {{#items}} ', formtemplate, ' {{/items}}'];
	return template.join('');
}

function render (resources) {
	var self = {};
	
	self.resources = resources;
	
	self.using = function (schema) {		
		self.name = schema.name;
		self.schema = schema;
		self.template = templateFromSchema(schema);
		
		return self;
	};

	self.into = function(elem) {
		window[self.name] = self; // XXX globals FTW!

		self.topElem = elem;
		
		self.domEventHandler = 'f' + self.schema.name + 'handle';
		elem.innerHTML = $.mustache(self.template, {
			items: self.resources,
			fgenerator: function () {
				return self.domEventHandler;
			}
		});
		window[self.domEventHandler] = self.wasClicked = function (elem) {
			var knownTypes = {
				'array': [0],
				'object': {'defaultProp': 0}
			};
			
			if(!(elem.tagName.toLowerCase() === 'input' || elem.tagName.toLowerCase() === 'button')) {
				alert('w0t ?');
				return ;
			}

			var property = elem.name;
			var id = elem.form.getAttribute('id');

			if(!(self.schema.properties[property].type in knownTypes)) {
				console.log('a property was clicked but i dont know about it');
				return ;
			}
		
			var resource = self.resources.filter(function(x) {return x.id === id})[0]; // XXX ze pain
			var json = (resource && resource[property]) ||
								 self.schema.properties[property].default;
			if(JSON.stringify(json) === '{}')	{json = knownTypes[self.schema.properties[property].type]}; // XXX MORE PAIN
			showJsonEditor(json, function (ev) {
			  if(!resource) {resource = {id: id, resource: self.schema.name}; self.resources.push(resource)}// maybe this is a new object
				console.log(id, property, json);
				resource[property] = json; // XXX can you believe this api ? 
			});
		}

		var butnew = elem.querySelector('#create-new-' + self.name);
		butnew.onclick = function() {
			if(!self.formschema) {
				self.formschema = formTemplateFromSchema(self.schema);
			}
			var div = createElem('div');
			var uuid = fakeGuid();
			div.innerHTML = $.mustache(self.formschema, {id: uuid});
			self.topElem.insertBefore(div, self.topElem.children[1]);
			makeResourceEditable(uuid, true);
			div.children[0].querySelector('[name=id]').disabled = false;
			div.children[0].querySelector('[name=save]').onclick = function() {saveResource(uuid)};
			
			function saveResource (uuid) {
				makeResourceEditable(uuid, false);
				var form = document.getElementById(uuid);
				socket.emit(lowerplural(self.name), 'create', getDataFromForm(form), function (err, resource) {
					if(err) {
						console.log(err);
						alert('save failed');
						makeResourceEditable(uuid, true);
						return ;
					}

					form.id = resource.id;
				})
			}
		}

		return self;
	}

	return self;
}

function showResource (resource) {

	resource = resource.toLowerCase() + 's';
	console.log('showresource ', resource);
	socket.emit(resource, 'getschema', {}, function (err, schema) {
		if(err) {
			return someError(err);
		}
	
		var resdiv = document.getElementById('resourcepane');
		resdiv.innerHTML = '';
	
		socket.emit(resource, 'all', {}, function(err, resources) {
			if(err) {
				return someError(err);
			}
			render(resources).using(schema).into(resdiv);
		});
	});
}

function loadResources (ul) {
	socket.emit('_', 'list', {}, function (err, result) {
		if(err) {
			alert('tha fail!');
			console.log(err);
			return ;
		}
	
		ul.innerHTML = '<li class="nav-header">Resources</li>';
		result.forEach(function(x) {
			var li = createElem('li'),
					a = createElem('a');
			a.href = '#';
			a.onclick = function() {showResource(x.name)};
			a.innerText = x.name;
			li.appendChild(a);
			ul.appendChild(li);
		});
	});
}


// ---------
// CRUFT
// --------
function createInputForField (name, prop, value) {
	var outerdiv = createElem('div');
	var controldiv = createElem('div');
	outerdiv.className = 'control-group';
	controldiv.className = 'controls';

	var input = createElem('input');
	input.disabled = true;
	input.name = name;
	switch(prop.type) {
		case 'string':
			input.type = 'text';
			input.value = value;
			break;
		case 'boolean':
			input.type = 'checkbox';
			input.checked = value;
		break;
		case 'number':
			input.type = 'number';
			input.value = value;
			break;
		case 'unix-time':
			input.type = 'datetime';
			input.valueAsNumber = value;
			break;
		case 'array':
		default:
			input = createElem('span');
			input.innerHTML = 'type '+prop.type+' is not supported!';
	}
		
	var label = createElem('label');
	label.for = name;
	label.innerText = name;
	label.className = 'control-label';

	outerdiv.appendChild(label); 
	controldiv.appendChild(input); 
	outerdiv.appendChild(controldiv);
	return outerdiv;
}

function createResourceView (resource, schema) {
	var links = resource.links;
	// we don't need these
	delete resource.links;

	var form = createElem('form');
	form.id = resource.id;
	form.dataset.resource = schema.name.toLowerCase() + 's';
	form.action = '#';
	form.className = 'form-horizontal';
	fieldset = createElem('fieldset');
	fieldset.className = 'well';

	fieldset.appendChild( createInputForField('id', {type: 'string'}, resource.id) );
	for (var p in schema.properties) {
		if(!schema.properties[p].private) {
			fieldset.appendChild( createInputForField(p, schema.properties[p], resource[p]) );
		}
	};

	var actiondiv = createElem('div');
	actiondiv.className = 'form-actions';
	var but = createElem('button');
	but.className = 'btn-primary';
	but.innerText = 'Edit';
	but.onclick = function() { return makeResourceEditable(form, true) };
	but.type = 'none';
	actiondiv.appendChild(but);
	fieldset.appendChild(actiondiv);
	form.appendChild(fieldset);
	
	return form;
}


