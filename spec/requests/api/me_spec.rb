require "rails_helper"

RSpec.describe "Api::Me", type: :request do
  let(:user) { create(:user, twitter_handle: "testuser", display_name: "Test User") }
  let(:auth_headers) { { "Authorization" => "Bearer #{user.auth_token}" } }

  describe "GET /api/me" do
    it "returns the current user profile" do
      get "/api/me", headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["twitter_handle"]).to eq("testuser")
      expect(json["display_name"]).to eq("Test User")
      expect(json["reputation_score"]).to be_a(Float)
      expect(json["rating_impact"]).to be_a(Float)
    end

    it "returns 401 without auth token" do
      get "/api/me"

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
