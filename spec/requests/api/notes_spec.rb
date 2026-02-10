require "rails_helper"

RSpec.describe "Api::Notes", type: :request do
  let(:user) { create(:user) }
  let(:auth_headers) { { "Authorization" => "Bearer #{user.auth_token}" } }

  describe "GET /api/notes" do
    it "returns notes for a given URL" do
      page = create(:page, url: "https://example.com/article")
      note = create(:note, page: page)

      get "/api/notes", params: { url: "https://example.com/article" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json.length).to eq(1)
      expect(json.first["id"]).to eq(note.id)
      expect(json.first["body"]).to eq(note.body)
      expect(json.first["selected_text"]).to eq(note.selected_text)
      expect(json.first["author"]["handle"]).to eq(note.author.twitter_handle)
    end

    it "returns empty array when no notes exist for URL" do
      get "/api/notes", params: { url: "https://example.com/no-notes" }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq([])
    end

    it "returns 400 when url param is missing" do
      get "/api/notes"

      expect(response).to have_http_status(:bad_request)
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
  end
end
