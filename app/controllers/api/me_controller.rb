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
        karma: current_user.karma,
        notes_count: current_user.notes.count,
        ratings_count: current_user.ratings.count,
        can_rate: current_user.can_rate?,
        can_write: current_user.can_write?
      }
    end
  end
end
