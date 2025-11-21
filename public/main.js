// /public/main.js

const { createApp } = Vue;
const API_URL = "http://localhost:3000/api"; 

createApp({
  data() {
    return {
      clients: [],
      logs: [],
      newClient: {
        name: "",
        retell_agent_id: "",
        cal_api_key: "",
        cal_event_type_id: null,
      },
      currentEditClient: null,
    };
  },
  methods: {
    // CRUD: READ
    async fetchData() {
      try {
        const [clientsRes, logsRes] = await Promise.all([
          fetch(`${API_URL}/clients`),
          fetch(`${API_URL}/logs`),
        ]);
        this.clients = await clientsRes.json();
        this.logs = await logsRes.json();
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    },

    // CRUD: CREATE
    async addClient() {
      try {
        await fetch(`${API_URL}/clients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.newClient),
        });
        this.newClient = {
          name: "",
          retell_agent_id: "",
          cal_api_key: "",
          cal_event_type_id: null,
        };
        this.fetchData();
      } catch (error) {
        alert("Failed to add client. Check server logs.");
      }
    },

    // CRUD: START EDIT (SETUP) - Shows the modal
    startEdit(client) {
      this.currentEditClient = { ...client };
    },

    // CRUD: CANCEL EDIT - Hides the modal without saving
    cancelEdit() {
      this.currentEditClient = null;
    },

    // CRUD: UPDATE
    async updateClient() {
      if (!this.currentEditClient.id) return;

      try {
        await fetch(`${API_URL}/clients/${this.currentEditClient.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.currentEditClient),
        });
        this.cancelEdit();
        this.fetchData();
      } catch (error) {
        alert("Failed to update client. Check server logs.");
      }
    },

    // CRUD: DELETE
    async deleteClient(clientId) {
      if (
        !confirm(
          "Are you sure you want to delete this client? This cannot be undone."
        )
      )
        return;

      try {
        await fetch(`${API_URL}/clients/${clientId}`, {
          method: "DELETE",
        });
        this.fetchData();
      } catch (error) {
        alert("Failed to delete client. Check server logs.");
      }
    },
  },
  mounted() {
    this.fetchData();
    // Refresh data every 10 seconds
    setInterval(this.fetchData, 10000);
  },
}).mount("#app");