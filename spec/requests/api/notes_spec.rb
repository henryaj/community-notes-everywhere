require "rails_helper"

RSpec.describe "Api::Notes", type: :request do
  let(:user) { create(:user, reputation_score: 30.0) }
  let(:auth_headers) { { "Authorization" => "Bearer #{user.auth_token}" } }

  describe "GET /api/notes" do
    it "returns notes for a given URL" do
      page = create(:page, url: "https://example.com/article")
      note = create(:note, page: page)

      get "/api/notes", params: { url: "https://example.com/article" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["notes"].length).to eq(1)
      expect(json["notes"].first["id"]).to eq(note.id)
      expect(json["notes"].first["body"]).to eq(note.body)
      expect(json["notes"].first["selected_text"]).to eq(note.selected_text)
      expect(json["notes"].first["author"]["handle"]).to eq(note.author.twitter_handle)
      expect(json["notes"].first["transparency"]).to be_a(Hash)
      expect(json["notes"].first["transparency"]["positive_count"]).to be_a(Integer)
      expect(json["notes"].first["author"]["profile_url"]).to start_with("/u/")
      expect(json["notes"].first["short_url"]).to start_with("/n/")
    end

    it "returns empty notes array when no notes exist for URL" do
      get "/api/notes", params: { url: "https://example.com/no-notes" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["notes"]).to eq([])
    end

    it "returns 400 when url param is missing" do
      get "/api/notes"

      expect(response).to have_http_status(:bad_request)
    end

    it "returns can_rate false when not authenticated" do
      get "/api/notes", params: { url: "https://example.com/test" }

      json = JSON.parse(response.body)
      expect(json["can_rate"]).to eq(false)
    end

    it "returns can_rate true when authenticated with sufficient reputation" do
      high_rep_user = create(:user, reputation_score: 30.0)
      headers = { "Authorization" => "Bearer #{high_rep_user.auth_token}" }

      get "/api/notes", params: { url: "https://example.com/test" }, headers: headers

      json = JSON.parse(response.body)
      expect(json["can_rate"]).to eq(true)
    end

    it "returns can_rate false when authenticated with low reputation" do
      low_rep_user = create(:user, reputation_score: 10.0)
      headers = { "Authorization" => "Bearer #{low_rep_user.auth_token}" }

      get "/api/notes", params: { url: "https://example.com/test" }, headers: headers

      json = JSON.parse(response.body)
      expect(json["can_rate"]).to eq(false)
    end

    it "returns can_write false when not authenticated" do
      get "/api/notes", params: { url: "https://example.com/test" }

      json = JSON.parse(response.body)
      expect(json["can_write"]).to eq(false)
    end

    it "returns can_write true when authenticated with sufficient reputation" do
      high_rep_user = create(:user, reputation_score: 30.0)
      headers = { "Authorization" => "Bearer #{high_rep_user.auth_token}" }

      get "/api/notes", params: { url: "https://example.com/test" }, headers: headers

      json = JSON.parse(response.body)
      expect(json["can_write"]).to eq(true)
    end

    it "returns can_write false when authenticated with low reputation" do
      low_rep_user = create(:user, reputation_score: 10.0)
      headers = { "Authorization" => "Bearer #{low_rep_user.auth_token}" }

      get "/api/notes", params: { url: "https://example.com/test" }, headers: headers

      json = JSON.parse(response.body)
      expect(json["can_write"]).to eq(false)
    end
  end

  describe "POST /api/notes" do
    let(:page_url) { "https://example.com/new-article" }

    it "creates a note and returns it" do
      post "/api/notes", params: {
        note: {
          url: page_url,
          body: "This needs context",
          selected_text: "some claim",
          text_prefix: "before ",
          text_suffix: " after",
          css_selector: "p.content"
        }
      }, headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["body"]).to eq("This needs context")
      expect(json["selected_text"]).to eq("some claim")
      expect(json["author"]["id"]).to eq(user.id)

      expect(Page.find_by(url: page_url)).to be_present
    end

    it "returns 401 without auth token" do
      post "/api/notes", params: {
        note: { url: page_url, body: "test", selected_text: "text" }
      }

      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 422 with invalid params" do
      post "/api/notes", params: {
        note: { url: page_url, body: "", selected_text: "" }
      }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 403 when user has low reputation" do
      low_rep_user = create(:user, reputation_score: 10.0)
      headers = { "Authorization" => "Bearer #{low_rep_user.auth_token}" }

      post "/api/notes", params: {
        note: { url: page_url, body: "This needs context", selected_text: "some claim" }
      }, headers: headers

      expect(response).to have_http_status(:forbidden)
      json = JSON.parse(response.body)
      expect(json["error"]).to include("reputation")
    end

    it "succeeds when user has exactly the threshold reputation" do
      threshold_user = create(:user, reputation_score: 25.0)
      headers = { "Authorization" => "Bearer #{threshold_user.auth_token}" }

      post "/api/notes", params: {
        note: { url: page_url, body: "This needs context", selected_text: "some claim" }
      }, headers: headers

      expect(response).to have_http_status(:created)
    end
  end

  describe "PATCH /api/notes/:id" do
    let(:note) { create(:note, author: user) }

    it "updates the note body" do
      patch "/api/notes/#{note.id}", params: {
        note: { body: "Updated context" }
      }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["body"]).to eq("Updated context")
      expect(note.reload.body).to eq("Updated context")
    end

    it "updates sources_linked" do
      patch "/api/notes/#{note.id}", params: {
        note: { sources_linked: true }
      }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["id"]).to eq(note.id)
      expect(note.reload.sources_linked).to eq(true)
    end

    it "returns 401 without auth token" do
      patch "/api/notes/#{note.id}", params: {
        note: { body: "Updated" }
      }

      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 403 when user is not the author" do
      other_user = create(:user, reputation_score: 30.0)
      other_headers = { "Authorization" => "Bearer #{other_user.auth_token}" }

      patch "/api/notes/#{note.id}", params: {
        note: { body: "Hacked" }
      }, headers: other_headers

      expect(response).to have_http_status(:forbidden)
      expect(note.reload.body).not_to eq("Hacked")
    end

    it "creates a version when editing within 10 minutes" do
      patch "/api/notes/#{note.id}", params: {
        note: { body: "Updated context" }
      }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(note.note_versions.count).to eq(1)
      expect(note.note_versions.first.previous_body).to eq("This claim needs additional context.")
      expect(note.reload.edited_at).to be_present
    end

    it "returns 403 when editing after 10 minutes" do
      note.update_column(:created_at, 11.minutes.ago)

      patch "/api/notes/#{note.id}", params: {
        note: { body: "Too late" }
      }, headers: auth_headers

      expect(response).to have_http_status(:forbidden)
      json = JSON.parse(response.body)
      expect(json["error"]).to include("Edit window")
      expect(note.reload.body).not_to eq("Too late")
    end

    it "does not allow updating selected_text" do
      original_text = note.selected_text

      patch "/api/notes/#{note.id}", params: {
        note: { body: "Updated", selected_text: "changed text" }
      }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(note.reload.selected_text).to eq(original_text)
    end
  end

  describe "GET /api/notes/:id/versions" do
    let(:note) { create(:note, author: user) }

    it "returns note versions" do
      create(:note_version, note: note, previous_body: "First version")
      create(:note_version, note: note, previous_body: "Second version")

      get "/api/notes/#{note.id}/versions"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json.length).to eq(2)
      expect(json.first["previous_body"]).to be_present
      expect(json.first["created_at"]).to be_present
    end
  end

  describe "GET /api/notes/:id/status_history" do
    let(:note) { create(:note, author: user) }

    it "returns status change history" do
      create(:note_status_change, note: note, from_status: 0, to_status: 1, trigger: "rating")

      get "/api/notes/#{note.id}/status_history"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json.length).to eq(1)
      expect(json.first["from_status"]).to eq("pending")
      expect(json.first["to_status"]).to eq("helpful")
      expect(json.first["trigger"]).to eq("rating")
      expect(json.first["changed_at"]).to be_present
    end

    it "returns empty array when no status changes exist" do
      get "/api/notes/#{note.id}/status_history"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json).to eq([])
    end
  end

  describe "DELETE /api/notes/:id" do
    let!(:note) { create(:note, author: user) }

    it "deletes the note" do
      expect {
        delete "/api/notes/#{note.id}", headers: auth_headers
      }.to change(Note, :count).by(-1)

      expect(response).to have_http_status(:no_content)
    end

    it "returns 401 without auth token" do
      delete "/api/notes/#{note.id}"

      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 403 when user is not the author" do
      other_user = create(:user, reputation_score: 30.0)
      other_headers = { "Authorization" => "Bearer #{other_user.auth_token}" }

      expect {
        delete "/api/notes/#{note.id}", headers: other_headers
      }.not_to change(Note, :count)

      expect(response).to have_http_status(:forbidden)
    end
  end
end
