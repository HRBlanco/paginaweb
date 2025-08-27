const CLIENT_ID = 'TU_CLIENT_ID';
const API_KEY = 'TU_API_KEY';
const CALENDAR_ID = 'tu_correo@gmail.com';
const SCOPES = "https://www.googleapis.com/auth/calendar.events";

let horaSeleccionada = null;

function gapiLoaded() { gapi.load('client:auth2', initClient); }

function initClient() {
  gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
    scope: SCOPES
  }).then(() => { listEvents(); });
}

function listEvents() {
  const fecha = document.getElementById("fecha").value || new Date().toISOString().split('T')[0];
  gapi.client.calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: new Date(fecha+'T00:00:00').toISOString(),
    timeMax: new Date(fecha+'T23:59:59').toISOString(),
    showDeleted: false,
    singleEvents: true,
    orderBy: 'startTime'
  }).then(resp => {
    const events = resp.result.items;
    renderHorarios(events);
  });
}

const horariosDisponibles = ["09:00","10:00","11:00","12:00","14:00","15:00","16:00"];
const horariosDiv = document.getElementById("horarios");
const fechaInput = document.getElementById("fecha");

function renderHorarios(events) {
  horariosDiv.innerHTML = "";
  const ocupados = events.map(e => e.start.dateTime.substring(11,16));
  horariosDisponibles.forEach(hora => {
    const btn = document.createElement("div");
    btn.classList.add("py-2","rounded","cursor-pointer","transition","text-center");
    btn.innerText = hora;
    if(ocupados.includes(hora)) {
      btn.classList.add("bg-red-300","cursor-not-allowed");
    } else {
      btn.classList.add("bg-green-300","hover:bg-green-400");
      btn.addEventListener("click", ()=> {
        horaSeleccionada = hora;
        document.querySelectorAll("#horarios div").forEach(d=>d.classList.remove("ring-2","ring-blue-700"));
        btn.classList.add("ring-2","ring-blue-700");
      });
    }
    horariosDiv.appendChild(btn);
  });
}

fechaInput.addEventListener("change", ()=>listEvents());
fechaInput.value = new Date().toISOString().split("T")[0];
window.onload = gapiLoaded;

const modal = document.getElementById("modalReserva");
const modalTexto = document.getElementById("modalTexto");
const confirmarBtn = document.getElementById("confirmarBtn");
const cancelarBtn = document.getElementById("cancelarBtn");
const reservarBtn = document.getElementById("reservarBtn");

reservarBtn.addEventListener("click", ()=>{
  if(!horaSeleccionada){ alert("Selecciona un horario"); return; }
  const fecha = fechaInput.value;
  modalTexto.innerText = `Deseas reservar la cita el ${fecha} a las ${horaSeleccionada}?`;
  modal.classList.remove("hidden");
});

cancelarBtn.addEventListener("click", ()=>{ modal.classList.add("hidden"); });

confirmarBtn.addEventListener("click", ()=>{
  modal.classList.add("hidden");
  const fecha = fechaInput.value;
  const startTime = new Date(fecha+'T'+horaSeleccionada+':00').toISOString();
  const endTime = new Date(new Date(startTime).getTime() + 60*60*1000).toISOString();

  const event = {
    'summary': 'Cita Paciente',
    'start': { 'dateTime': startTime, 'timeZone': 'America/Santiago' },
    'end': { 'dateTime': endTime, 'timeZone': 'America/Santiago' }
  };

  gapi.client.calendar.events.insert({
    'calendarId': CALENDAR_ID,
    'resource': event
  }).then(()=> {
    alert("Reserva creada correctamente!");
    horaSeleccionada = null;
    listEvents();
  }).catch(err => { console.log(err); alert("Error al crear reserva"); });
});
