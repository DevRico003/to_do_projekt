import express from 'express'
import bodyParser from 'body-parser'
import fs from 'fs/promises'
import path from 'path'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'url'

// Erhalte den Pfad des aktuellen Moduls
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = 3000
const dataPath = path.join(__dirname, 'data.json')

// Middleware zum Parsen von form-daten
app.use(bodyParser.urlencoded({ extended: true }))

// Daten aus der JSON-Datei lesen
async function readData() {
    const rawData = await fs.readFile(dataPath, 'utf-8')
    return JSON.parse(rawData)
}

// Daten in die JSON-Datei schreiben
async function writeData(data) {
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8')
}

// Hauptlogin-Seite
app.get('/', (req, res) => {
    const form = `
        <h1>To Do App Enrico Anna Christoph</h1>
        <form method="post" action="/login">
            <label for="name">Name:</label>
            <input name="name" type="text">
            <label for="pw">Passwort:</label>
            <input name="pw" type="password">
            <button type="submit">Login</button>
        </form>
        <br>
        <form method="get" action="/register">
            <button type="submit">Zur Registrierung</button>
        </form>
    `
    res.send(form)
})

// Registrierungsseite
app.get("/register", (req, res) => {
    const registerForm = `
        <h1>Registrierung</h1>
        <form method="post" action="/register">
            <label for="name">Name:</label>
            <input name="name" type="text">
            <label for="pw">Passwort:</label>
            <input name="pw" type="password">
            <button type="submit">Registrieren</button>
        </form>
        <br>
        <a href="/">Zurück zum Login</a>
    `
    res.send(registerForm)
})

app.post("/register", async (req, res) => {
    const { name, pw } = req.body
    const hashedPassword = await bcrypt.hash(pw, 10)
    const data = await readData()
    if (data.users.some(user => user.name === name)) {
        res.send("Registrierung fehlgeschlagen. Dieser Benutzername existiert bereits.")
        return
    }
    data.users.push({ name, passwort: hashedPassword })
    data.userTodoLists[name] = []
    await writeData(data)
    res.redirect(`/todolist?name=${name}`)
})

app.post("/login", async (req, res) => {
    const { name, pw } = req.body
    const data = await readData()
    const user = data.users.find(u => u.name === name)
    if (user && await bcrypt.compare(pw, user.passwort)) {
        renderTodoList(res, name, data)
        return
    }
    res.send("Login fehlgeschlagen")
})

// Neues Todo hinzufügen
app.post('/addtodo', async (req, res) => {
    const { name, title, description, dueDate, category } = req.body

    const data = await readData()

    if (!data.userTodoLists[name]) {
        data.userTodoLists[name] = []
    }

    const newTodo = {
        title,
        description: description || "",
        dueDate: dueDate || "",
        category: category || "Allgemein", // Default-Kategorie
        status: "Offen"
    }

    data.userTodoLists[name].push(newTodo)
    await writeData(data)
    renderTodoList(res, name, data)
})

// Status des Todos ändern
app.post('/togglestatus', async (req, res) => {
    const { name, index } = req.body
    const data = await readData()
    const todo = data.userTodoLists[name][index]

    // Toggle den Status zwischen "Offen" und "Erledigt"
    todo.status = todo.status === "Offen" ? "Erledigt" : "Offen"
    await writeData(data)

    renderTodoList(res, name, data)
})

// To-Do-Liste eines Benutzers anzeigen
app.get("/todolist", async (req, res) => {
    const { name } = req.query
    const data = await readData()
    renderTodoList(res, name, data)
})

// Suchroute für Todos
app.get("/searchtodos", async (req, res) => {
    const { name, query, type } = req.query
    const data = await readData()
    let filteredTodos = []

    if (data.userTodoLists[name]) {
        switch(type) {
            case 'title':
                filteredTodos = data.userTodoLists[name].filter(todo => todo.title.includes(query))
                break
            case 'description':
                filteredTodos = data.userTodoLists[name].filter(todo => todo.description.includes(query))
                break
            case 'dueDate':
                filteredTodos = data.userTodoLists[name].filter(todo => todo.dueDate === query)
                break
            case 'category':
                filteredTodos = data.userTodoLists[name].filter(todo => todo.category.includes(query))
                break
            default:
                res.send("Ungültiger Suchtyp.")
                return
        }
    }
    renderFilteredTodoList(res, name, filteredTodos)
})

function renderFilteredTodoList(res, name, todos) {
    const todoListHtml = todos.map((item, index) => `
        <li>
            <strong>${item.title}</strong>
            ${item.description ? `<br>${item.description}` : ""}
            <br>Kategorie: ${item.category}
            <br>Status: ${item.status}
            <form method="post" action="/togglestatus">
                <input type="hidden" name="name" value="${name}">
                <input type="hidden" name="index" value="${index}">
                <button type="submit">Status ändern</button>
            </form>
        </li>
    `).join("")

    const userTodoList = `
        <h2>Suchergebnisse für ${name}</h2>
        <ul>${todoListHtml}</ul>
    `

    res.send(userTodoList)
}

// Funktion zum Rendern der To-Do-Liste
function renderTodoList(res, name, data) {
    const todoListHtml = data.userTodoLists[name].map((item, index) => `
        <li>
            <strong>${item.title}</strong>
            ${item.description ? `<br>${item.description}` : ""}
            <br>Status: ${item.status}
            <form method="post" action="/togglestatus">
                <input type="hidden" name="name" value="${name}">
                <input type="hidden" name="index" value="${index}">
                <button type="submit">Status ändern</button>
            </form>
        </li>
    `).join("")

    const userTodoList = `
        <h2>To-Do-Liste für ${name}</h2>
        <form method="post" action="/addtodo">
            <input type="hidden" name="name" value="${name}">
            <label for="title">Titel:</label>
            <input name="title" type="text" placeholder="Titel" required>
            <label for="description">Beschreibung:</label>
            <input name="description" type="text" placeholder="Beschreibung (optional)">
            <label for="dueDate">Fälligkeitsdatum:</label>
            <input name="dueDate" type="date">
            <label for="status">Status:</label>
            <select name="status">
                <option value="Offen">Offen</option>
                <option value="Erledigt">Erledigt</option>
            </select>
            <button type="submit">Hinzufügen</button>
        </form>
        <form method="post" action="/searchtodo">
            <input type="hidden" name="name" value="${name}">
            <label for="query">Suche:</label>
            <input name="query" type="text" placeholder="Suche">
            <button type="submit">Suchen</button>
        </form>
        <ul>${todoListHtml}</ul>
    `
    res.send(userTodoList)
}

app.listen(port, () => {
    console.log(`Express-Server hört auf Port ${port}`)
})