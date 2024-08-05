const s3 = require('./lib/s3');
const combine = require('stream-combiner')
const AWS = require('aws-sdk');


module.exports = function setupS3DestNode(RED) {
	function S3DestNode(config) {
		RED.nodes.createNode(this, config);
		this.path = config.path;
		// eslint-disable-next-line consistent-this
		var node = this;
		node.on('input', function handleInput (msg, send) {
			let configObj = { buffer:false, ...msg.config } // default to streaming mode

			if (msg.topic && !msg.topic.startsWith('gulp')) {
				this.status({ fill: 'red', shape: 'dot', text: 'missing .src node' });
			} else if (msg.topic == 'gulp-info') {
				// ignore this informational message--but pass it along below
			} else if (msg.topic == 'gulp-initialize') {
				if (!msg.plugins) {
					node.warn('s3.dest: cannot initialize; missing gulp.src?')
					return;
				}

				if (msg?.config?.s3)
					configObj.s3 = new AWS.S3(msg.config.s3);

				if (node.path) { // e.g. 's3://bucket/folder/etc' or 'bucket/folder/etc'
					let path = node.path.split('//');
					if (path.length > 2) // e.g. ['s3:','bucket/folder/etc']
						throw new Error('invalid path: ' + node.path) // must have had multiple double-slashes
					else 
						path = path[path.length - 1]; // grab last element of path, removing any prefix

					if (!configObj.awsOptions)
						configObj.awsOptions = {};

					configObj.awsOptions.Bucket = path;
					
					// path = path.split('/');   // e.g. ['bucket', 'folder', 'etc']
					// configObj.awsOptions.Bucket = path[0] || configObj.awsOptions.Bucket;  // e.g. 'bucket'
					// path.unshift(); // remove bucket from path array
					// configObj.awsOptions.Key = path.join('/') || configObj.awsOptions.Key  ; // e.g. 'folder/etc'
				}

				console.log('s3.dest: creating gulp stream; combining ' + msg.plugins.length + ' plugin streams');
				// console.log('node.path: ', node.path);
				
				// console.log('configObj: ', configObj);
				// expected configObj: {
				// 	s3: AWS.S3;
				// 	base: string;
				// 	awsOptions: {
				// 		Bucket: string;
				// 	};
				// }

				combine(msg.plugins.map((plugin) => plugin.init()))
					.pipe(s3.dest('', configObj) // empty "root" param; any path has been extracted into configObj
					// .pipe(s3.dest('', { s3: configObj.s3, awsOptions: { Bucket: baleMailTarget.bucket } }))
					// .pipe(s3.dest(node.path, { s3: configObj.s3})
				
					// .pipe(s3.dest(node.path, configObj)	// TypeError
					// .pipe(s3.dest(node.path, {awsOptions: {
					// 	Bucket: 'bale-mail-data/messages'}})
					// .pipe(s3.dest(node.path)	
						.on('data', (file) => {
							this.status({ fill: 'green', shape: 'dot', text: 'active' });

							// send an info message to announce the file we're processing
							let fileDescription = `${file.history[0].split(/[\\/]/).pop()} -> ${file?.inspect()}`;
							// console.log('gulp.dest:', fileDescription)
							send({...msg, topic:'gulp-info', parts:{id:msg._msgid}, _msgid:'', payload:`gulpfile: ${fileDescription}`,gulpfile:file});
						})
						.on('end', () => {
							this.status({ fill: 'green', shape: 'ring', text: 'ready' });
							
							send({...msg, topic:'gulp-finalize', parts:{id:msg._msgid}, _msgid:''});
						})

					);

				this.status({ fill: 'green', shape: 'ring', text: 'ready' });
			}

			send(msg);
		});
	}
	RED.nodes.registerType('s3.dest', S3DestNode);
}
