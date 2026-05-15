// 1 - Invocamos a Express  Heroku
const express = require('express');
const app = express();

global.globalFolder = 2;
const V_Log = 0;
global.V_Log = V_Log;
if (V_Log === 5) {
	console.log(globalFolder); // Output: "This can be accessed anywhere!"
}

//2 - Para poder capturar los datos del formulario (sin urlencoded nos devuelve "undefined")
app.use(express.urlencoded({ extended: false, limit: '15mb' }));
app.use(express.json());//además le decimos a express que vamos a usar json

//3- Invocamos a dotenv
const dotenv = require('dotenv');
dotenv.config({ path: './env/.env'});

//4 -seteamos el directorio de assets
app.use('/resources',express.static('public'));
app.use('/resources', express.static(__dirname + '/public'));

//5 - Establecemos el motor de plantillas
app.set('view engine','ejs');

//6 -Invocamos a bcrypt
//const bcrypt = require('bcryptjs');

//7- variables de session
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);


// 8 - Invocamos a la conexion de la DB
const connection = require('./database/db');
const {
	sendLoginNotification,
	sendParticipantEmail
} = require('./services/loginEmailNotifier');

const sessionStore = new MySQLStore({
	clearExpired: true,
	checkExpirationInterval: 900000,
	expiration: 86400000,
	createDatabaseTable: true,
	schema: {
		tableName: 'sessions',
		columnNames: {
			session_id: 'session_id',
			expires: 'expires',
			data: 'data'
		}
	}
}, connection);

app.use(session({
	secret: process.env.SESSION_SECRET || 'secret',
	resave: false,
	saveUninitialized: false,
	store: sessionStore
}));

// Ayuda de diagnostico temporal para revisar la configuracion y el archivo de log.
// Reactivar solo cuando se necesite depurar el flujo de correo.
if (V_Log === 6) {
	console.log('[login-email] Configuracion cargada:', getEmailConfigurationSummary());
	console.log('[login-email] Archivo de log:', LOGIN_EMAIL_LOG_PATH);
}

function getClientIp(req) {
	const forwardedFor = req.headers['x-forwarded-for'];

	if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
		return forwardedFor.split(',')[0].trim();
	}

	if (req.socket && req.socket.remoteAddress) {
		return req.socket.remoteAddress;
	}

	return req.ip || 'desconocida';
}

function notifySuccessfulLogin(req, participant) {
	if (!participant) {
		return Promise.resolve({
			sent: false,
			skipped: true,
			reason: 'missing participant'
		});
	}

	if (V_Log === 6) {
		console.log('[login-email] Disparando notificacion para alias:', participant.Alias);
	}

	return sendLoginNotification({
		alias: participant.Alias,
		name: participant.Nombre,
		email: participant.Correo,
		level: participant.Nivel,
		status: participant.Estatus,
		ipAddress: getClientIp(req),
		loggedAt: new Date()
	}).then((result) => {

		if (V_Log === 6) {
			console.log('[login-email] Resultado final:', result);
		}

		return result;
	}).catch((error) => {
		if (V_Log === 6) {
			console.error('[login-email] No se pudo enviar el correo de login:', error);
		}
		return {
			sent: false,
			error: error.message
		};
	});
}

function notifyRegistration(req, participant) {
	if (!participant) {
		return Promise.resolve({
			sent: false,
			skipped: true,
			reason: 'missing participant'
		});
	}

	return sendLoginNotification({
		alias: participant.Alias,
		name: participant.Nombre,
		email: participant.Correo,
		level: participant.Nivel || 0,
		status: participant.Estatus || 0,
		ipAddress: getClientIp(req),
		loggedAt: new Date()
	}, {
		subjectPrefix: 'Registro : ',
		bodyIntro: 'Se detecto un registro en mundial 2026.'
	}).catch((error) => {
		if (V_Log === 6) {
			console.error('[login-email] No se pudo enviar el correo de registro:', error);
		}
		return {
			sent: false,
			error: error.message
		};
	});
}

function notifyPasswordRequest(req, participant) {
	if (!participant) {
		return Promise.resolve({
			sent: false,
			skipped: true,
			reason: 'missing participant'
		});
	}

	return sendLoginNotification({
		alias: participant.Alias,
		name: participant.Nombre,
		email: participant.Correo,
		level: participant.Nivel || 0,
		status: participant.Estatus || 0,
		ipAddress: getClientIp(req),
		loggedAt: new Date()
	}, {
		subject: 'Recuperar Contraseña',
		bodyIntro: 'Se detectá una solicitud para recuperar Contraseña en mundial 2026.'
	}).catch((error) => {
		if (V_Log === 6) {
			console.error('[login-email] No se pudo enviar el correo de recuperaciónn de Contraseña:', error);
		}
		return {
			sent: false,
			error: error.message
		};
	});
}

//10 - establecemos las rutas
	app.get('/acceso',(req, res)=>{
		res.render('acceso');
	})

app.get('/register',(req, res)=>{
		res.render('register');
	})

//puntos
app.get('/puntos', (req, res)=> {


	if (V_Log === 5) {
		console.log('Debug P ',req.session.Folder);
	    console.log(globalFolder);
		console.log('Debud ',req.session.loggedin);
		console.log('Debud ',req.session.Alias);
	}
	
		if (req.session.loggedin) {
			res.render('puntos',{
				login: true,
				Alias: req.session.Alias,
				Nivel: req.session.Nivel,
				Folder: req.body.Id_Folder
			});		
		} else {
			res.render('puntos',{
				login:false,
				Alias:'Debe iniciar sesión',
				Nivel: '0'			
			});				
		}
		res.end();
	});

//puntos
app.get('/puntosC', (req, res)=> {

	if (V_Log === 5) {
		console.log('Debud ',req.session.loggedin);
		console.log('Debud ',req.session.Alias);
	}
	
		if (req.session.loggedin) {
			res.render('puntosC',{
				login: true,
				Alias: req.session.Alias,
				Nivel: req.session.Nivel,
				Folder: req.body.Id_Folder
			});		
		} else {
			res.render('puntosC',{
				login:false,
				Alias:'Debe iniciar sesión',
				Nivel: '0'			
			});				
		}
		res.end();
	});

//10 - Método para la REGISTRO
app.post('/register', async (req, res)=>{
	const user = req.body.user;
	const name = req.body.name;
    const rol = req.body.rol;
	const pass = req.body.pass;
	let passwordHash = await bcrypt.hash(pass, 8);
    connection.query('INSERT INTO users SET ?',{user:user, name:name, rol:rol, pass:passwordHash}, async (error, results)=>{
        if(error){
            console.log(error);
        }else{            
			res.render('register', {
				alert: true,
				alertTitle: "Registration",
				alertMessage: "Successful Registration!",
				alertIcon:'success',
				showConfirmButton: false,
				timer: 1500,
				ruta: ''
			});
            //res.redirect('/');         
        }
	});
})

//10 - Metodo para la autenticacion
app.post('/registra_save1', async (req, res)=> {
	const Alias = req.body.Alias;
	const pass = req.body.pass;    

    const Id_participante = req.body.Id_participante;
    const Id_Folder = req.body.Id_Folder;
    const Nombre = req.body.Nombre;
    const Contacto = req.body.Contacto;
    const Correo = req.body.Correo;

	if (V_Log === 0) {
		console.log('El Alias es: ' + Alias);
		console.log('El pass  es: ' + pass);
	}

	if (Alias && pass) {
		connection.query('SELECT * FROM participantes WHERE alias = ?', [Alias], async (error, results, fields)=> {

			if( results.length == 0  ) {  


				if (V_Log === 0) {
					console.log({Correo:Correo, Nombre:Nombre,Contacto:Contacto});
				}
				

				connection.query('INSERT INTO participantes SET Nombre=?, Alias=?, Contacto=?, Correo=?, Pass= ?',[Nombre, Alias, Contacto, Correo, pass], async (error, results)=>{
	
					if(error){
						if (V_Log === 0) {
							console.log(error);
						}
					}else{
						if (V_Log === 5) {
							console.log(results);
						}

					    req.session.loggedin = false;


						if (V_Log === 0) {
							console.log('Espere aviso de activación');
						}

					// Send email in background without waiting
					notifyRegistration(req, {
						Alias,
						Nombre,
						Correo,
						Contacto,
						Nivel: 0,
						Estatus: 0
					}).catch((error) => {
						console.error('[registra_save1] Error sending registration email:', error);
					});

	if (V_Log === 0) {
		console.log('Usuario registrado');
	}
	res.render('acceso', {
		alert: true,
		alertTitle: "Espere aviso de activación",
		alertMessage: "USUARIO REGISTRADO!",
		alertIcon:'info',
		showConfirmButton: true,
		timer: false,
		ruta: 'acceso'
	}); 

			}
	});

			} else {         
				if (V_Log === 0) {
					console.log('Usuario registrado');
				}
				res.render('acceso', {
					alert: true,
					alertTitle: "Usuario registrado",
					alertMessage: "YA EXISTE USUARIO!",
					alertIcon:'success',
					showConfirmButton: false,
					timer: 1500,
					ruta: 'acceso'
				}); 
			}			
			//res.end();
		});

	} else {	
		res.render('acceso', {
			alert: true,
			alertTitle: "escriba usuario y Contraseña",
			alertMessage: "Incompleto",
			alertIcon:'success',
			showConfirmButton: false,
			timer: 1500,
			ruta: ''
		}); 
	}
});

//11 - Metodo para la autenticacion
app.post('/auth', async (req, res)=> {
	const user = req.body.user;
	const pass = req.body.pass;    
//    let passwordHash = await bcrypt.hash(pass, 8);


	if (V_Log === 5) {
		console.log('Accesa 0: ' + user);
	}
	if (V_Log === 5) {
		console.log('El pass A es: ' + pass);
	}

	if (user && pass) {
		connection.query('SELECT * FROM participantes WHERE alias = ?', [user], async (error, results, fields)=> {
			if (error) {
				if (V_Log === 0) {
					console.log(error);
				}
				res.render('acceso', {
                        alert: true,
                        alertTitle: "Error",
                        alertMessage: "NO SE PUDO VALIDAR EL ACCESO",
                        alertIcon:'error',
                        showConfirmButton: true,
                        timer: false,
                        ruta: 'acceso'    
                    });
				return;
			}

			if( results.length == 0  ) {  

				if (V_Log === 0) {
					console.log('Usuario no registrado: ');
				}

				res.render('acceso', {
                        alert: true,
                        alertTitle: "Error",
                        alertMessage: "USUARIO INCORRECTO!",
                        alertIcon:'error',
                        showConfirmButton: true,
                        timer: false,
                        ruta: 'acceso'    
                    });
				return;
							
			} else {
				const participant = results[0];
				const fin = Date.now();

				if (V_Log === 0) {
					console.log(participant.Alias, 'Tiempo:', new Date(fin).toUTCString());
				}

				if (pass != participant.Pass) {
					res.render('acceso', {
						alert: true,
						alertTitle: "Error",
						alertMessage: "CLAVE INCORRECTA!",
						alertIcon:'error',
						showConfirmButton: true,
						timer: false,
						ruta: 'acceso'
					});
					return;
				}

				const estatus = Number(participant.Estatus);
				const isActive = estatus === 1;

				if (isActive) {
					req.session.loggedin = true;
					req.session.Id_participante = participant.Id_participante;
					req.session.Alias = participant.Alias;
					req.session.Nivel = participant.Nivel;
					req.session.Estatus = participant.Estatus;
					req.session.Folder = participant.Id_Folder;
					
					if (V_Log === 5) {
						console.log('Activo 0');
						console.log('isActive: ' + isActive);
						console.log('estatus: ' + estatus);
						console.log('Folder ',req.session.Folder);
						console.log('loggedin ',req.session.loggedin);
					}

				} else {
					if (V_Log === 0) {
						console.log('Espere aviso de activación');
					}
					req.session.loggedin = false;
					req.session.Id_participante = participant.Id_participante;
					req.session.Alias = participant.Alias;
					req.session.Nivel = participant.Nivel;
					req.session.Estatus = participant.Estatus;
					if (V_Log === 0) {
						console.log('El app_aut Id es: ' + req.session.Id_participante);
						console.log('El usuario es: ' + req.session.Alias);
					}
				}

				// Send login notification email in background without waiting
				notifySuccessfulLogin(req, participant).catch((error) => {
					console.error('[auth] Error sending login notification email:', error);
				});

//				console.log('isActive: 0' , req.session.loggedin);
//				console.log('isActive: ' + isActive);

				if (isActive) {
                  if (V_Log === 5) {	
					console.log('isActive: 1' , req.session.loggedin);
					console.log('estatus: ' , req.session.Estatus);
					console.log('Folder ',req.session.Folder);
					console.log('loggedin 1 ',req.session.loggedin);
				  }

					req.session.save((err) => {
						if (err) {
							console.error('[auth] Error saving session:', err);
						}
						res.redirect('/quinielaC');
					});
					return;
				}

				res.render('acceso', {
					alert: true,
					alertTitle: "Espere aviso de activación ",
					alertMessage: "LOGIN CORRECTO!",
					alertIcon:'info',
					showConfirmButton: true,
					timer: false,
					ruta: ''
				});
				return;
			}			
			res.end();
		});


	} else {	
		res.send('Please enter user and Password!');
		res.end();
	}
});

function renderAccessAlert(res, alertTitle, alertMessage, alertIcon) {
	return res.render('acceso', {
		alert: true,
		alertTitle,
		alertMessage,
		alertIcon,
		showConfirmButton: true,
		timer: false,
		ruta: 'acceso'
	});
}

function parseMultipartHeaders(headerBlock) {
	const lines = headerBlock.split('\r\n');
	const headers = {};

	lines.forEach((line) => {
		const separatorIndex = line.indexOf(':');
		if (separatorIndex === -1) {
			return;
		}

		headers[line.slice(0, separatorIndex).trim().toLowerCase()] = line.slice(separatorIndex + 1).trim();
	});

	return headers;
}

function splitBuffer(buffer, separator) {
	const parts = [];
	let offset = 0;
	let index = buffer.indexOf(separator, offset);

	while (index !== -1) {
		parts.push(buffer.slice(offset, index));
		offset = index + separator.length;
		index = buffer.indexOf(separator, offset);
	}

	parts.push(buffer.slice(offset));
	return parts;
}

function parseMultipartRequest(req) {
	return new Promise((resolve, reject) => {
		const contentType = req.headers['content-type'] || '';
		const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

		if (!boundaryMatch) {
			reject(new Error('No se encontro el boundary del formulario.'));
			return;
		}

		const boundary = Buffer.from('--' + (boundaryMatch[1] || boundaryMatch[2]));
		const chunks = [];

		req.on('data', (chunk) => {
			chunks.push(chunk);
		});

		req.on('end', () => {
			const rawParts = splitBuffer(Buffer.concat(chunks), boundary);
			const fields = {};
			const files = {};

			rawParts.forEach((partBuffer) => {
				if (!partBuffer.length) {
					return;
				}

				let normalizedPart = partBuffer;

				if (normalizedPart.slice(0, 2).equals(Buffer.from('\r\n'))) {
					normalizedPart = normalizedPart.slice(2);
				}

				if (normalizedPart.equals(Buffer.from('--\r\n')) || normalizedPart.equals(Buffer.from('--'))) {
					return;
				}

				if (normalizedPart.slice(-2).equals(Buffer.from('\r\n'))) {
					normalizedPart = normalizedPart.slice(0, -2);
				}

				if (normalizedPart.slice(-2).equals(Buffer.from('--'))) {
					normalizedPart = normalizedPart.slice(0, -2);
				}

				const headerEndIndex = normalizedPart.indexOf(Buffer.from('\r\n\r\n'));

				if (headerEndIndex === -1) {
					return;
				}

				const headers = parseMultipartHeaders(normalizedPart.slice(0, headerEndIndex).toString('utf8'));
				const disposition = headers['content-disposition'] || '';
				const nameMatch = disposition.match(/name="([^"]+)"/i);

				if (!nameMatch) {
					return;
				}

				const fieldName = nameMatch[1];
				const contentBuffer = normalizedPart.slice(headerEndIndex + 4);
				const filenameMatch = disposition.match(/filename="([^"]*)"/i);

				if (filenameMatch && filenameMatch[1]) {
					files[fieldName] = {
						filename: filenameMatch[1],
						contentType: headers['content-type'] || 'application/octet-stream',
						buffer: contentBuffer
					};
					return;
				}

				fields[fieldName] = contentBuffer.toString('utf8');
			});

			resolve({ fields, files });
		});

		req.on('error', reject);
	});
}

app.post('/recupera_pass', (req, res)=> {
	const Alias = req.body.Alias;
	const Correo = req.body.Correo;
	const Pass = req.body.Pass;
	const Pass2 = req.body.Pass2;

	if (!Alias || !Correo || !Pass || !Pass2) {
		return renderAccessAlert(res, "Datos incompletos", "ESCRIBE ALIAS, CORREO Y LA NUEVA CONTRASEÑA", 'warning');
	}

	if (Pass !== Pass2) {
		return renderAccessAlert(res, "Contraseñas diferentes", "LA NUEVA CONTRASEÑA NO COINCIDE", 'error');
	}

	connection.query(
		'SELECT Id_participante, Alias, Correo, Nombre, Nivel, Estatus, Pass FROM participantes WHERE Alias = ? AND Correo = ?',
		[Alias, Correo],
		async (error, results) => {
			if (error) {
				return renderAccessAlert(res, "Error", "NO FUE POSIBLE VALIDAR EL USUARIO", 'error');
			}

			if (!results || results.length === 0) {
				return renderAccessAlert(res, "Usuario no encontrado", "NO EXISTE USUARIO CON ESE ALIAS Y CORREO", 'warning');
			}

			if (results[0].Pass === Pass) {
				return renderAccessAlert(res, "Sin cambios", "LA NUEVA CONTRASEÑA ES IGUAL A LA ACTUAL", 'info');
			}

			if (Number(results[0].Estatus) !== 4) {
				return renderAccessAlert(res, "Sin autorizacion", "EL USUARIO NO TIENE AUTORIZACION PARA CAMBIAR LA CONTRASEÑA", 'warning');
			}

			connection.query(
				'UPDATE participantes SET Pass = ?, Estatus = 1 WHERE Id_participante = ?',
				[Pass, results[0].Id_participante],
				(updateError) => {
					if (updateError) {
						return renderAccessAlert(res, "Error", "NO FUE POSIBLE ACTUALIZAR LA CONTRASEÑA", 'error');
					}

					return renderAccessAlert(res, "Contraseña actualizada", "YA PUEDES INGRESAR CON TU NUEVA CONTRASEÑA", 'success');
				}
			);
		}
	);
});

app.post('/solicita_pass', (req, res)=> {
	const Alias = req.body.Alias;
	const Correo = req.body.Correo;

	if (!Alias || !Correo) {
		return renderAccessAlert(res, "Datos incompletos", "ESCRIBE ALIAS Y CORREO", 'warning');
	}

	connection.query(
		'SELECT Id_participante, Alias, Correo, Nombre, Nivel, Estatus FROM participantes WHERE Alias = ? AND Correo = ?',
		[Alias, Correo],
		async (error, results) => {
			if (error) {
				return renderAccessAlert(res, "Error", "NO FUE POSIBLE VALIDAR EL USUARIO", 'error');
			}

			if (!results || results.length === 0) {
				return renderAccessAlert(res, "Usuario no encontrado", "NO EXISTE USUARIO CON ESE ALIAS Y CORREO", 'warning');
			}

			await notifyPasswordRequest(req, results[0]);
			return renderAccessAlert(res, "Solicitud enviada", "ESPERA CORREO DE AUTORIZACIÓN PARA CAMBIO DE CONTRASEÑA", 'success');
		}
	);
});

app.post('/Correo/enviar', async (req, res)=> {
	if (!req.session.loggedin) {
		return res.status(401).json({ ok: false, message: 'Debes iniciar sesion para enviar correos.' });
	}

	try {
		const { fields, files } = await parseMultipartRequest(req);
		const selectedIds = JSON.parse(fields.selectedIds || '[]');
		const subject = (fields.subject || '').trim();
		const message = (fields.message || '').trim();
		const attachment = files.attachment;

		if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
			return res.status(400).json({ ok: false, message: 'Selecciona al menos un registro.' });
		}

		if (!subject || !message) {
			return res.status(400).json({ ok: false, message: 'Escribe asunto y mensaje antes de enviar.' });
		}

		const placeholders = selectedIds.map(() => '?').join(',');
		const sql = `SELECT Id_participante, Nombre, Alias, Correo FROM participantes WHERE Id_participante IN (${placeholders})`;

		connection.query(sql, selectedIds, async (error, results) => {
			if (error) {
				return res.status(500).json({ ok: false, message: 'No fue posible obtener los destinatarios.' });
			}

			const recipients = (results || []).filter((participant) => participant.Correo);

			if (recipients.length === 0) {
				return res.status(400).json({ ok: false, message: 'Los registros seleccionados no tienen correo disponible.' });
			}

			const attachments = attachment && attachment.buffer && attachment.buffer.length > 0
				? [{ filename: attachment.filename, content: attachment.buffer, contentType: attachment.contentType }]
				: [];

			const sendResults = [];

			for (const participant of recipients) {
				try {
					await sendParticipantEmail(participant, { subject, message, attachments, minimalLogs: true });
					sendResults.push({ id: participant.Id_participante, email: participant.Correo, sent: true });
				} catch (sendError) {
					console.error('[correo] No se pudo enviar el correo a', participant.Correo, sendError);
					sendResults.push({ id: participant.Id_participante, email: participant.Correo, sent: false });
				}
			}

			const successCount = sendResults.filter((item) => item.sent).length;
			return res.json({
				ok: successCount > 0,
				message: `Se enviaron ${successCount} de ${recipients.length} correos seleccionados.`,
				results: sendResults
			});
		});
	} catch (error) {
		console.error('[correo] Error al procesar el formulario de correo:', error);
		return res.status(500).json({ ok: false, message: 'No fue posible procesar el envio de correos.' });
	}
});

app.get('/', (req, res)=> {
//	res.redirect('/acceso');

	globalFolder = 2;
	
	if (V_Log === 1) {
		console.log('Folder Usr ',globalFolder);
	}

	if (req.session.loggedin) {
		res.render('calendario',{
			login: true,
			name: req.session.name,
			Folder: 2			
		});		
	} else {
		res.render('calendario',{
			login:false,
			name:'Debe iniciar sesión',		
			Folder: 2	
		});				 
	}
	res.end();
});

app.get('/famL', (req, res)=> {

	globalFolder = 1;
	if (V_Log === 5) {
		console.log(globalFolder);
	}

	if (req.session.loggedin) {
		res.render('calendario',{
			login: true,
			name: req.session.name,
			Folder: 1			
		});		
	} else {
		res.render('calendario',{
			login:false,
			name:'Debe iniciar sesión',	
			Folder: 1		
		});				 
	}
	res.end();
});

app.get('/garcia', (req, res)=> {

	globalFolder = 3;
	if (V_Log === 0) {
		console.log(req.session.loggedin);
	}
	if (V_Log === 5) {
		console.log(globalFolder);
	}

	if (req.session.loggedin) {
		res.render('ranking',{
			login: true,
			name: req.session.name,
			Folder: 3			
		});		
	} else {
		res.render('ranking',{
			login:false,
			name:'Debe iniciar sesión',	
			Folder: 3		
		});				 
	}
	res.end();
});

app.get('/CSA', (req, res)=> {

	globalFolder = 2;

	if (V_Log === 5) {
		console.log(globalFolder);
	}

	if (req.session.loggedin) {
		res.render('calendario',{
			login: true,
			name: req.session.name,
			Folder: 2			
		});		
	} else {
		res.render('calendario',{
			login:false,
			name:'Debe iniciar sesión',	
			Folder: 2		
		});				 
	}
	res.end();
});

app.get('/ranking', (req, res)=> {

	if (V_Log === 1) {
		console.log(globalFolder);
	}

	if( globalFolder == 0  ) {  
		if (V_Log === 1) {
			console.log(globalFolder);
		}
		res.render('resultados',{
			login: true,
			name: req.session.name,			
		});	
	} else {	
		if (V_Log === 1) {
			console.log(globalFolder);
		}
		res.render('ranking',{
			login: true,
			name: req.session.name,			
		});	
	}


	res.end();
});

//funcián para limpiar la caché luego del logout
app.use(function(req, res, next) {
    if (!req.user)
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    next();
});

//Destruye la sesión.
app.get('/salir', function (req, res) {
	req.session.destroy(() => {
	  res.redirect('/acceso') // siempre se ejecutará después de que se destruya la sesión
	})
});
 
//compara
app.get('/compara', (req, res)=> {

	if (V_Log === 5) {
		console.log('Debud ',req.session.loggedin);
		console.log('Debud ',req.session.Alias);
	}

	if (req.session.loggedin) {
		res.render('compara',{
			login: true,
			Alias: req.session.Alias,
			Folder: req.session.Folder,
		
		});		
	} else {
		res.render('compara',{
			login:false,
			Alias:'Debe iniciar sesión',			
		});				
	}
	res.end();
});

//partidos
app.get('/partidos', (req, res)=> {

	if (V_Log === 5) {
		console.log('Debud ',req.session.loggedin);
		console.log('Debud ',req.session.Alias);
	}

	if (req.session.loggedin) {
		res.render('partidos',{
			login: true,
			Alias: req.session.Alias,
			Nivel: req.session.Nivel		
		});		
	} else {
		res.render('partidos',{
			login:false,
			Alias:'Debe iniciar sesión',
			Nivel: '0'			
		});				
	}
	res.end();
});

//quiniela 16
app.get('/quiniela', (req, res)=> {

	if (V_Log === 5) {
		console.log('Debug Q ',req.session.loggedin);
		console.log('Debug Q ',req.session.Alias);
		console.log('Debug Q ',req.session.Id_participante);
	}

	if (req.session.loggedin) {
		res.render('quiniela',{
			login: true,
			Alias: req.session.Alias,
			Id_participante: req.session.Id_participante,
			Estatus: req.session.Estatus
		});
	} else {
		res.render('quiniela',{
			login:false,
			Alias:'Debe iniciar sesión',
		});
	}
	res.end();
});


//quinielaC
app.get('/quinielaC', (req, res)=> {

	if (V_Log === 5) {
	    console.log('Debug Folder QC ',req.session.Folder);
	    console.log(globalFolder);
		console.log('Debug QC ',req.session.loggedin);
		console.log('Debug Q ',req.session.Alias);
		console.log('Debug Q ',req.session.Id_participante);
	}
	
	console.log('Debug Q ',req.session.Id_participante);

		if (req.session.loggedin) {
			res.render('quinielaC',{
				login: true,
				Alias: req.session.Alias,
				Nivel: req.session.Nivel,
				Id_participante: req.session.Id_participante,
				Folder: globalFolder,
			});
		} else {
			res.render('quinielaC',{
				login:false,
				Alias:'Debe iniciar sesión',
			});
		}
		res.end();
	});

//Campeon
app.get('/campeon', (req, res)=> {

	if (V_Log === 5) {
		console.log('Debug Q ',req.session.loggedin);
		console.log('Debug Q ',req.session.Alias);
		console.log('Debug Q ',req.session.Id_participante);
	}
	
		if (req.session.loggedin) {
			res.render('resultados',{
				login: true,
				Alias: req.session.Alias,
				Nivel: req.session.Nivel,
				Id_participante: req.session.Id_participante,
				Folder: globalFolder,
			});
		} else {
			res.render('resultados',{
				login:false,
				Alias:'Debe iniciar sesión',
			});
		}
		res.end();
	});
	

//RUTA para puntos 
app.get('/puntosC', (req,res)=>{

	if (V_Log === 5) {
		console.log('Debug Q ',req.session.loggedin);
		console.log('Debug Q ',req.session.Alias);
		console.log('Debug Q ',req.session.Id_participante);
	}
	
	if (req.session.loggedin) {
		res.render('puntosC',{
			login: true,
			Alias: req.session.Alias,
			Nivel: req.session.Nivel,
			Id_participante: req.session.Id_participante
		});
	} else {
		res.render('puntosC',{
			login:false,
			Alias:'Debe iniciar sesión',
		});
	}
	res.end();
});

//RUTA para regresiva
app.get('/participantes', (req,res)=>{

	if (V_Log === 5) {
		console.log('Debug Q ',req.session.loggedin);
		console.log('Debug Q ',req.session.Alias);
		console.log('Debug Q ',req.session.Id_participante);
	}
	
	if (req.session.loggedin) {
		res.render('participantes',{
			login: true,
			Alias: req.session.Alias,
			Nivel: req.session.Nivel,
			Id_participante: req.session.Id_participante
		});
	} else {
		res.render('participantes',{
			login:false,
			Alias:'Debe iniciar sesión', 
		});
	}
	res.end();
});

app.get('/participantes2', (req,res)=>{

	if (V_Log === 5) {
		console.log('Debug Q ',req.session.loggedin);
		console.log('Debug Q ',req.session.Alias);
		console.log('Debug Q ',req.session.Id_participante);
	}
	
	if (req.session.loggedin) {
		res.render('participantes2',{
			login: true,
			Alias: req.session.Alias,
			Nivel: req.session.Nivel,
			Id_participante: req.session.Id_participante
		});
	} else {
		res.render('participantes2',{
			login:false,
			Alias:'Debe iniciar sesión', 
		});
	}
	res.end();
});

app.get('/Correo', (req,res)=>{
	if (req.session.loggedin) {
		res.render('Correo',{
			login: true,
			Alias: req.session.Alias,
			Nivel: req.session.Nivel,
			Id_participante: req.session.Id_participante
		});
	} else {
		res.render('Correo',{
			login:false,
			Alias:'Debe iniciar sesión'
		});
	}
	res.end();
});

app.use('/', require('./router'));

//const port = process.env.PORT

//	app.listen(port, () => {
if (V_Log === 5) {
	console.log(`Server Running on port: ${process.env.PORT}`);
}
//    });

//app.listen(port || 3000)
if (V_Log === 5) {
	console.log(`Servidor ejecutando desde el puerto`, process.env.PORT || 3000);
}


//Local
// app.listen(4000, (req, res)=>{
if (V_Log === 5) {
	console.log('SERVER RUNNING IN http://localhost:4000');
}
//}); 

//rawly
//const PORT = process.env.PORT || 3000;

//app.listen(PORT, '0.0.0.0', () => {
if (V_Log === 5) {
	console.log(`Servidor en puerto ${PORT}`);
}
//});


const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  if (V_Log === 0) {
	console.log(`Server running on http://${HOST}:${PORT}`);
  }
});


