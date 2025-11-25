  const firebaseConfig = {
    apiKey: "AIzaSyBbq301d9EmuJkjVObRTaQmCJ_2_niunPg",
    authDomain: "fastway-autospare-parts-2c90d.firebaseapp.com",
    projectId: "fastway-autospare-parts-2c90d",
    storageBucket: "fastway-autospare-parts-2c90d.firebasestorage.app",
    messagingSenderId: "1044393920782",
    appId: "1:1044393920782:web:5ae5717dfad9958f3fef5f",
    measurementId: "G-B8TEXK3K3R"
  };
 // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
let database = [
  {
    id: 1,
    zoren: "ZRM0003011",
    oem: ["31110-09000", "E8678M"],
    name: "Fuel Pump",
    car_maker: "Hyundai",
    applications: "HYUNDAI SONATA 2.0 / KIA OPTIMA 2001–2005",
    search: "zrm0003011 31110-09000 e8678m hyundai sonata kia optima fuel pump"
  }
];

let editId = null; // track editing

function escapeHtml(text){return String(text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultDiv = document.getElementById('result');
const messageDiv = document.getElementById('message');

const toggleAddFormBtn = document.getElementById('toggleAddForm');
const addFormWrap = document.getElementById('addFormWrap');
const addProductBtn = document.getElementById('addProductBtn');
const cancelAddBtn = document.getElementById('cancelAddBtn');

const jsonFileInput = document.getElementById('jsonFileInput');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const importJsonBtn = document.getElementById('importJsonBtn');

// ---------- SEARCH ----------
function searchParts(q) {
  q = (q||'').trim().toLowerCase();
  if(!q) return [];
  return database.filter(item=>{
    const oemMatch = item.oem.some(o=>o.toLowerCase().includes(q));
    const zorenMatch = item.zoren.toLowerCase().includes(q);
    const nameMatch = item.name.toLowerCase().includes(q);
    const searchMatch = item.search.toLowerCase().includes(q);
    return oemMatch||zorenMatch||nameMatch||searchMatch;
  });
}

function renderResults(results, rawQuery){
  if(!rawQuery){
    resultDiv.innerHTML = `<div class="message" style="display:block">Please enter OEM, ZOREN or product name to search.</div>`;
    return;
  }
  if(!results.length){
    resultDiv.innerHTML = `<div class="message" style="display:block">No results found for "<strong>${escapeHtml(rawQuery)}</strong>".</div>`;
    return;
  }
  resultDiv.innerHTML = results.map(item=>{
    const oemBadges = (item.oem||[]).map(o=>`<span class="badge">${escapeHtml(o)}</span>`).join('');
    return `
      <div class="product-card" data-id="${item.id}">
        <div class="product-image">📦</div>
        <div class="product-info">
          <h3>${escapeHtml(item.name)}</h3>

          <div class="field-title">ZOREN NUMBER</div>
          <div><span class="badge">${escapeHtml(item.zoren)}</span></div>

          <div class="field-title">OEM NUMBERS</div>
          <div>${oemBadges}</div>

          <div class="field-title">CAR MAKER</div>
          <div class="small">${escapeHtml(item.car_maker)}</div>

          <div class="field-title">APPLICATIONS</div>
          <div class="small">${escapeHtml(item.applications)}</div>

          <div class="product-actions">
            <button class="edit-btn" onclick="editProduct(${item.id})">Edit</button>
            <button class="delete-btn" onclick="deleteProduct(${item.id})">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ---------- search click ----------
searchBtn.addEventListener('click',()=>{renderResults(searchParts(searchInput.value),searchInput.value)});
searchInput.addEventListener('keydown',e=>{if(e.key==='Enter')searchBtn.click()});

// ---------- toggle add form ----------
toggleAddFormBtn.addEventListener('click',()=>{addFormWrap.style.display=addFormWrap.style.display==='none'?'block':'none';document.getElementById('formTitle').innerText='Add New Product'; editId=null; clearAddForm();});
cancelAddBtn.addEventListener('click',()=>{addFormWrap.style.display='none'; editId=null; clearAddForm();});

// ---------- add / save product ----------
addProductBtn.addEventListener('click',()=>{
  const zoren = document.getElementById('add_zoren').value.trim();
  const oemRaw = document.getElementById('add_oem').value.trim();
  const name = document.getElementById('add_name').value.trim();
  const maker = document.getElementById('add_maker').value.trim();
  const apps = document.getElementById('add_apps').value.trim();
  const searchField = document.getElementById('add_search').value.trim();
  if(!zoren||!oemRaw||!name){showMessage('ZOREN, OEM, Name are required.',true); return;}
  const oemList = oemRaw.split(',').map(x=>x.trim()).filter(Boolean);

  if(editId){
    // edit mode
    const item = database.find(d=>d.id===editId);
    if(item){
      item.zoren=zoren; item.oem=oemList; item.name=name; item.car_maker=maker; item.applications=apps;
      item.search=(searchField||[zoren].concat(oemList,[name,maker,apps]).join(' ')).toLowerCase();
      showMessage(`Product "${name}" updated successfully.`,false);
    }
  }else{
    // add new
    const newItem={id:Date.now(),zoren,oem:oemList,name,car_maker:maker,applications:apps,search:(searchField||[zoren].concat(oemList,[name,maker,apps]).join(' ')).toLowerCase()};
    database.push(newItem);
    showMessage(`Product "${name}" added successfully.`,false);
  }

  addFormWrap.style.display='none';
  clearAddForm();
  renderResults(database, searchInput.value||name);
});

function clearAddForm(){
  ['add_zoren','add_oem','add_name','add_maker','add_apps','add_search'].forEach(id=>{document.getElementById(id).value='';});
}

// ---------- EDIT ----------
function editProduct(id){
  const item = database.find(d=>d.id===id);
  if(!item) return;
  editId=id;
  document.getElementById('formTitle').innerText='Edit Product';
  document.getElementById('add_zoren').value=item.zoren;
  document.getElementById('add_oem').value=item.oem.join(',');
  document.getElementById('add_name').value=item.name;
  document.getElementById('add_maker').value=item.car_maker;
  document.getElementById('add_apps').value=item.applications;
  document.getElementById('add_search').value=item.search;
  addFormWrap.style.display='block';
}

// ---------- DELETE ----------
function deleteProduct(id){
  if(!confirm('Are you sure to delete this product?')) return;
  database = database.filter(d=>d.id!==id);
  showMessage('Product deleted successfully.',false);
  renderResults(database, searchInput.value);
}

// ---------- IMPORT JSON ----------
chooseFileBtn.addEventListener('click',()=>jsonFileInput.click());
jsonFileInput.addEventListener('change',e=>{if(e.target.files && e.target.files[0]) showMessage(`Selected file: ${e.target.files[0].name}`,false,3000);});
importJsonBtn.addEventListener('click',()=>{
  const file=jsonFileInput.files&&jsonFileInput.files[0];
  if(!file){showMessage('Choose JSON file first.',true);return;}
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const parsed=JSON.parse(e.target.result);
      let items=[];
      if(Array.isArray(parsed)) items=parsed;
      else if(parsed && Array.isArray(parsed.products)) items=parsed.products;
      else {showMessage('JSON must be array or {products:[...]}',true);return;}
      let added=0;
      for(const it of items){
        if(!it.zoren||!it.oem||!it.name) continue;
        const oems=Array.isArray(it.oem)?it.oem.map(x=>String(x).trim()).filter(Boolean):String(it.oem).split(',').map(x=>x.trim()).filter(Boolean);
        const newItem={id:Date.now()+Math.random(),zoren:String(it.zoren).trim(),oem:oems,name:String(it.name).trim(),car_maker:it.car_maker?String(it.car_maker).trim():'',applications:it.applications?String(it.applications).trim():'',search:(it.search?String(it.search).trim() : [it.zoren].concat(oems,[it.name,it.car_maker,it.applications]).join(' ')).toLowerCase()};
        database.push(newItem);added++;
      }
      showMessage(`Imported ${added} product(s).`,false);
      jsonFileInput.value='';
      renderResults(database, searchInput.value);
    }catch(err){console.error(err);showMessage('Invalid JSON.',true);}
  };
  reader.readAsText(file);
});

// ---------- MESSAGE ----------
function showMessage(text,isError=false,timeout=4000){messageDiv.style.display='block';messageDiv.style.background=isError?'rgba(255,200,200,0.95)':'rgba(255,255,255,0.95)';messageDiv.style.color=isError?'#800':'#222';messageDiv.innerHTML=escapeHtml(text);if(timeout)setTimeout(()=>messageDiv.style.display='none',timeout);}

// ---------- initial render ----------
renderResults([], '');
const exportJsonBtn = document.getElementById('exportJsonBtn');

exportJsonBtn.addEventListener('click', () => {
  if (!database.length) {
    showMessage('No products to export.', true);
    return;
  }
  const dataStr = JSON.stringify(database, null, 2); // formatted JSON
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'spare_parts_database.json';
  a.click();
  URL.revokeObjectURL(url);

  showMessage('Products exported successfully!', false, 3000);

});
