module Api
  class MeController < ApplicationController
    before_action :authenticate!

    # GET /api/me
    def show
      render json: {
        id: current_user.id,
        twitter_handle: current_user.twitter_handle,
        display_name: current_user.display_name,
        avatar_url: current_user.avatar_url,
        reputation_score: current_user.reputation_score,
        notes_count: current_user.notes.count,
        ratings_count: current_user.ratings.count
      }
    end
  end
end
