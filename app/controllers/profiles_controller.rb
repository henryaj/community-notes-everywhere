class ProfilesController < ActionController::Base
  layout "pages"

  def show
    @user = User.find_by(twitter_handle: params[:twitter_handle])
    unless @user
      render "not_found", status: :not_found
      return
    end

    @notes = @user.public_notes.limit(20)
    @stats = @user.profile_stats
    @page = 1
  end

  def notes
    @user = User.find_by(twitter_handle: params[:twitter_handle])
    unless @user
      head :not_found
      return
    end

    @page = (params[:page] || 1).to_i
    @notes = @user.public_notes.limit(20).offset((@page - 1) * 20)

    render partial: "notes_page", locals: { notes: @notes, user: @user, page: @page }
  end
end
