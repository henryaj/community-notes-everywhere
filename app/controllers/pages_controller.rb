class PagesController < ActionController::Base
  layout "pages"

  def home
  end

  def privacy
  end

  def terms
  end

  def account
    token = params[:token] || session[:auth_token]
    @user = User.find_by(auth_token: token) if token
    unless @user
      redirect_to "/auth/dev", allow_other_host: true
      return
    end
    session[:auth_token] = token
    @notes = @user.notes.includes(:page).order(created_at: :desc)
    @ratings = @user.ratings.includes(note: :author).order(created_at: :desc)
  end
end
