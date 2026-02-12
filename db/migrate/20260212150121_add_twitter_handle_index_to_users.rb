class AddTwitterHandleIndexToUsers < ActiveRecord::Migration[8.1]
  def change
    add_index :users, :twitter_handle, unique: true
  end
end
