require "rails_helper"

RSpec.describe "NotesRedirect", type: :request do
  describe "GET /n/:short_id" do
    it "renders the landing page for a valid note" do
      note = create(:note)

      get "/n/#{note.short_id}"

      expect(response).to have_http_status(:ok)
      expect(response.body).to include(note.body)
      expect(response.body).to include(note.author.display_name)
      expect(response.body).to include("@#{note.author.twitter_handle}")
      expect(response.body).to include(note.selected_text.truncate(300))
      expect(response.body).to include(note.page.domain)
      expect(response.body).to include("View on page")
    end

    it "includes a link to the original page with the cne-note hash" do
      note = create(:note)

      get "/n/#{note.short_id}"

      expect(response.body).to include("#{note.page.url}#cne-note=#{note.id}")
    end

    it "shows the status badge" do
      note = create(:note, status: :helpful)

      get "/n/#{note.short_id}"

      expect(response.body).to include("Rated helpful")
    end

    it "returns 404 for a nonexistent short_id" do
      get "/n/nonexistent"

      expect(response).to have_http_status(:not_found)
      expect(response.body).to include("Note not found")
    end

    it "returns 404 for a hidden note (reports_count >= 3)" do
      note = create(:note, reports_count: 3)

      get "/n/#{note.short_id}"

      expect(response).to have_http_status(:not_found)
    end

    it "includes extension install prompt" do
      note = create(:note)

      get "/n/#{note.short_id}"

      expect(response.body).to include("Community Notes Everywhere")
      expect(response.body).to include("Chrome extension")
    end
  end
end
